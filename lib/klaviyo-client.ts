/**
 * lib/klaviyo-client.ts
 *
 * Klaviyo letto direttamente dalla sua API, con una **private API key per
 * cliente** — non serve OAuth, non c'è nulla da far approvare e la chiave non
 * scade. La chiave vive cifrata nella sottocollection `integrations` del
 * cliente, come gli altri token (vedi lib/api-auth.ts).
 *
 * Sostituisce il connector Windsor, che esponeva sei campi in tutto
 * (campaign, opens, clicks, revenue, open_rate, click_rate) e non aveva né
 * recipients né unsubscribes né bounces: qui arriva anche la **salute della
 * lista** — recapito, disiscrizioni, reclami spam — che è la parte di un
 * report email che il cliente guarda per prima.
 */

import { adminDb } from './firebase-admin';

const BASE = 'https://a.klaviyo.com/api';

/**
 * Klaviyo versiona l'API per data e la richiede su ogni chiamata. Alzarla è un
 * aggiornamento deliberato: cambia forma alle risposte, quindi va fatto
 * leggendo il changelog, non per tenersi "aggiornati".
 */
const REVISION = '2026-07-15';

function headers(apiKey: string, json = false): Record<string, string> {
    return {
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: REVISION,
        accept: 'application/vnd.api+json',
        ...(json ? { 'content-type': 'application/vnd.api+json' } : {}),
    };
}

function explainError(status: number, body: string): string {
    if (status === 401 || status === 403) {
        return 'Chiave API Klaviyo non valida o senza i permessi necessari. '
            + 'Serve una Private API Key con accesso in lettura a accounts, metrics e campaigns.';
    }
    if (status === 429) return 'Klaviyo ha applicato un rate limit: riprova tra qualche minuto.';
    return `Klaviyo ha risposto ${status}: ${body.slice(0, 200)}`;
}

async function call(apiKey: string, path: string, init?: RequestInit): Promise<any> {
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: headers(apiKey, init?.method === 'POST'),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(explainError(res.status, body));
    }
    return res.json();
}

export interface KlaviyoAccount {
    id: string;
    name: string;
    currency?: string;
}

/** Valida la chiave e restituisce l'account a cui appartiene. */
export async function getKlaviyoAccount(apiKey: string): Promise<KlaviyoAccount> {
    const json = await call(apiKey, '/accounts');
    const a = json.data?.[0];
    if (!a) throw new Error('La chiave è valida ma non restituisce alcun account Klaviyo.');
    return {
        id: a.id,
        name: a.attributes?.contact_information?.organization_name || a.id,
        currency: a.attributes?.preferred_currency,
    };
}

/**
 * Trova la metrica di conversione da usare nei report.
 *
 * ⚠️ Un account ha spesso **più "Placed Order"**: una creata dall'integrazione
 * e-commerce e una generica via API. Su Yeppon quella Shopify dà 66 conversioni
 * e €25.352 nel mese, quella API ne dà **zero** — scegliere la seconda avrebbe
 * mostrato al cliente un fatturato email di zero euro su un canale che ne
 * genera venticinquemila. Si preferisce quindi sempre quella che arriva da una
 * vera integrazione, mai quella marcata "API".
 */
export async function findConversionMetricId(apiKey: string): Promise<string | null> {
    const json = await call(apiKey, '/metrics');
    const metrics: any[] = json.data || [];
    const placed = metrics.filter((m) => /placed order/i.test(m.attributes?.name || ''));
    if (placed.length === 0) return null;

    const fromIntegration = placed.find((m) => {
        const source = m.attributes?.integration?.name;
        return source && source.toLowerCase() !== 'api';
    });
    return (fromIntegration || placed[0]).id;
}

/**
 * Le statistiche chieste a Klaviyo. Ognuna è un nome accettato dall'endpoint
 * campaign-values-reports — un nome sbagliato qui fa fallire la chiamata con
 * un 400, quindi a differenza di Windsor un refuso si vede subito.
 */
const STATISTICS = [
    'recipients', 'delivered', 'delivery_rate',
    'opens_unique', 'open_rate',
    'clicks_unique', 'click_rate', 'click_to_open_rate',
    'unsubscribes', 'unsubscribe_rate',
    'bounced', 'bounce_rate', 'spam_complaints',
    'conversions', 'conversion_value', 'revenue_per_recipient',
] as const;

/** Tassi che non vanno sommati fra campagne: si ricalcolano dai totali. */
const RATE_STATS = new Set([
    'delivery_rate', 'open_rate', 'click_rate', 'click_to_open_rate',
    'unsubscribe_rate', 'bounce_rate', 'revenue_per_recipient',
]);


type Timeframe = { key: string } | { start: string; end: string };

/* ─── Cache ──────────────────────────────────────────────────────────────
 *
 * L'endpoint dei report è limitato a **2 richieste al minuto** e 225 al giorno
 * (limiti dichiarati da Klaviyo, non stimati). Un report con confronto ne fa
 * già due — quindi basta che due persone aprano la stessa pagina nello stesso
 * minuto perché la scheda vada in errore. Senza cache questa integrazione
 * sarebbe rotta di fatto.
 *
 * I dati sono statistiche di campagne già inviate: cambiano lentamente, mezz'ora
 * di staleness non si nota. Su un 429 si serve comunque la copia in cache
 * anche se scaduta: un numero di ieri è incomparabilmente meglio di un errore.
 */
const CACHE_COLLECTION = 'klaviyo_report_cache';
const CACHE_TTL_MS = 30 * 60 * 1000;

function cacheDocId(cacheKey: string, timeframe: Timeframe, metricId: string): string {
    const tf = 'key' in timeframe ? timeframe.key : `${timeframe.start}_${timeframe.end}`;
    return `${cacheKey}__${metricId}__${tf}`.replace(/[^A-Za-z0-9_.@+-]/g, '_');
}

async function readCache(id: string): Promise<{ totals: KlaviyoTotals; fetchedAt: number } | null> {
    try {
        const snap = await adminDb.collection(CACHE_COLLECTION).doc(id).get();
        if (!snap.exists) return null;
        const d = snap.data() as { totals?: KlaviyoTotals; fetchedAt?: number };
        return d?.totals && d.fetchedAt ? { totals: d.totals, fetchedAt: d.fetchedAt } : null;
    } catch {
        // La cache non deve mai essere il motivo per cui il report fallisce.
        return null;
    }
}

async function writeCache(id: string, totals: KlaviyoTotals): Promise<void> {
    try {
        await adminDb.collection(CACHE_COLLECTION).doc(id).set({ totals, fetchedAt: Date.now() });
    } catch { /* idem */ }
}

export interface KlaviyoTotals {
    [metric: string]: number;
    campaigns: number;
    recipients: number;
    delivered: number;
    opens_unique: number;
    clicks_unique: number;
    unsubscribes: number;
    bounced: number;
    spam_complaints: number;
    conversions: number;
    conversion_value: number;
    open_rate: number;
    click_rate: number;
    unsubscribe_rate: number;
}

/**
 * Totali email del periodo, sommati su tutte le campagne.
 *
 * I tassi vengono **ricalcolati dai totali** invece di essere sommati o mediati
 * fra campagne: la media semplice di sette tassi di apertura darebbe lo stesso
 * peso a un invio da 200 destinatari e a uno da 200.000.
 */
export async function getKlaviyoTotals(
    apiKey: string,
    conversionMetricId: string,
    timeframe: Timeframe,
    cacheKey?: string
): Promise<KlaviyoTotals> {
    return valuesReport(apiKey, conversionMetricId, timeframe, 'campaign', cacheKey);
}

async function valuesReport(
    apiKey: string,
    conversionMetricId: string,
    timeframe: Timeframe,
    kind: 'campaign' | 'flow',
    cacheKey?: string
): Promise<KlaviyoTotals> {
    const cacheId = cacheKey ? cacheDocId(`${cacheKey}__${kind}`, timeframe, conversionMetricId) : null;
    const cached = cacheId ? await readCache(cacheId) : null;
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.totals;

    let json: any;
    try {
        json = await callReport(apiKey, conversionMetricId, timeframe, kind);
    } catch (err: any) {
        // Rate limit: meglio un dato vecchio di un errore in faccia al cliente.
        if (cached && /rate limit/i.test(err.message)) return cached.totals;
        throw err;
    }

    const results: any[] = json.data?.attributes?.results || [];
    const sum: Record<string, number> = {};
    for (const row of results) {
        for (const [key, value] of Object.entries(row.statistics || {})) {
            if (typeof value !== 'number' || RATE_STATS.has(key)) continue;
            sum[key] = (sum[key] || 0) + value;
        }
    }

    const n = (k: string) => sum[k] || 0;
    const rate = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);

    const totals: KlaviyoTotals = {
        campaigns: results.length,
        recipients: n('recipients'),
        delivered: n('delivered'),
        opens_unique: n('opens_unique'),
        clicks_unique: n('clicks_unique'),
        unsubscribes: n('unsubscribes'),
        bounced: n('bounced'),
        spam_complaints: n('spam_complaints'),
        conversions: n('conversions'),
        conversion_value: Math.round(n('conversion_value') * 100) / 100,
        open_rate: rate(n('opens_unique'), n('delivered')),
        click_rate: rate(n('clicks_unique'), n('delivered')),
        unsubscribe_rate: rate(n('unsubscribes'), n('delivered')),
    };

    if (cacheId) await writeCache(cacheId, totals);
    return totals;
}

function callReport(
    apiKey: string,
    conversionMetricId: string,
    timeframe: Timeframe,
    kind: 'campaign' | 'flow' = 'campaign'
): Promise<any> {
    return call(apiKey, `/${kind}-values-reports`, {
        method: 'POST',
        body: JSON.stringify({
            data: {
                type: `${kind}-values-report`,
                attributes: {
                    statistics: [...STATISTICS],
                    timeframe,
                    conversion_metric_id: conversionMetricId,
                },
            },
        }),
    });
}


/**
 * Totali dei **flussi** (automazioni: carrello abbandonato, benvenuto,
 * post-acquisto), sommati su tutti i flussi attivi nel periodo.
 *
 * Per un e-commerce i flussi generano spesso più fatturato delle campagne:
 * vanno da soli, tutti i giorni, su chi ha già mostrato un'intenzione. Un
 * report email che mostra solo le campagne racconta la metà meno interessante.
 *
 * Stesso endpoint-gemello delle campagne, stessi identici limiti (2 richieste
 * al minuto), quindi passa dalla stessa cache — con una chiave distinta.
 */
export async function getKlaviyoFlowTotals(
    apiKey: string,
    conversionMetricId: string,
    timeframe: Timeframe,
    cacheKey?: string
): Promise<KlaviyoTotals> {
    return valuesReport(apiKey, conversionMetricId, timeframe, 'flow', cacheKey);
}


export interface KlaviyoRow {
    id: string;
    name: string;
    channel: string;
    recipients: number;
    delivered: number;
    opens_unique: number;
    clicks_unique: number;
    unsubscribes: number;
    conversions: number;
    conversion_value: number;
    open_rate: number;
    click_rate: number;
    revenue_per_recipient: number;
}

/**
 * Il dettaglio riga per riga di campagne e flussi.
 *
 * ⚠️ Costa **una sola** chiamata al report, non una per riga: la risposta di
 * `campaign-values-reports` è già raggruppata per `campaign_id` — finora la
 * stavamo sommando e buttando via il dettaglio. Con 2 richieste al minuto
 * questa è la differenza fra una pagina che si apre e una che va in errore.
 *
 * I nomi arrivano da un endpoint separato (`/campaigns`, `/flows`), che non
 * condivide il limite stretto dei report. Se quella chiamata fallisce si
 * mostra comunque la riga, con l'id al posto del nome: meglio un dato con
 * un'etichetta brutta che nessun dato.
 */
export async function getKlaviyoBreakdown(
    apiKey: string,
    conversionMetricId: string,
    timeframe: Timeframe,
    kind: 'campaign' | 'flow',
    cacheKey?: string
): Promise<KlaviyoRow[]> {
    const [report, names] = await Promise.all([
        callReport(apiKey, conversionMetricId, timeframe, kind),
        // I nomi sono cosmetici: se falliscono si mostrano gli id, ma
        // l'errore va almeno registrato invece di sparire.
        fetchNames(apiKey, kind).catch((err) => {
            console.warn(`[klaviyo] nomi ${kind} non risolti:`, err.message);
            return new Map<string, string>();
        }),
    ]);

    const results: any[] = report.data?.attributes?.results || [];
    const byId = new Map<string, KlaviyoRow>();

    for (const r of results) {
        const g = r.groupings || {};
        const id = String(g[`${kind}_id`] ?? '');
        if (!id) continue;
        const st = r.statistics || {};

        // Un flusso ha più messaggi: le righe con lo stesso id vanno sommate.
        const e = byId.get(id) || {
            id, name: names.get(id) || id, channel: String(g.send_channel ?? ''),
            recipients: 0, delivered: 0, opens_unique: 0, clicks_unique: 0,
            unsubscribes: 0, conversions: 0, conversion_value: 0,
            open_rate: 0, click_rate: 0, revenue_per_recipient: 0,
        };
        e.recipients += Number(st.recipients || 0);
        e.delivered += Number(st.delivered || 0);
        e.opens_unique += Number(st.opens_unique || 0);
        e.clicks_unique += Number(st.clicks_unique || 0);
        e.unsubscribes += Number(st.unsubscribes || 0);
        e.conversions += Number(st.conversions || 0);
        e.conversion_value += Number(st.conversion_value || 0);
        byId.set(id, e);
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    return Array.from(byId.values())
        .map((r) => ({
            ...r,
            conversion_value: round(r.conversion_value),
            open_rate: r.delivered > 0 ? round((r.opens_unique / r.delivered) * 100) : 0,
            click_rate: r.delivered > 0 ? round((r.clicks_unique / r.delivered) * 100) : 0,
            revenue_per_recipient: r.recipients > 0 ? round(r.conversion_value / r.recipients) : 0,
        }))
        .sort((a, b) => b.conversion_value - a.conversion_value);
}

/**
 * Nomi leggibili per id, da un endpoint separato che non condivide il limite
 * stretto dei report.
 *
 * ⚠️ `page[size]` massimo è **50**: con 100 Klaviyo risponde 400, non una
 * lista troncata. Con un catch silenzioso quell'errore diventava
 * semplicemente "nessun nome", e il dettaglio flussi mostrava id come
 * `RZz74a` al posto di "Carrello abbandonato" senza che nulla lo segnalasse.
 * Si pagina finché ci sono pagine, e un fallimento viene almeno registrato.
 */
async function fetchNames(apiKey: string, kind: 'campaign' | 'flow'): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    let path: string | null = kind === 'campaign'
        ? '/campaigns?filter=equals(messages.channel,"email")&page[size]=50'
        : '/flows?page[size]=50';

    // Tetto di sicurezza: senza, un `next` sempre valorizzato girerebbe a vuoto.
    for (let page = 0; path && page < 10; page++) {
        const json: any = await call(apiKey, path);
        for (const x of (json.data || [])) {
            if (x?.id && x?.attributes?.name) map.set(String(x.id), String(x.attributes.name));
        }
        const next: string | undefined = json.links?.next;
        path = next ? next.replace('https://a.klaviyo.com/api', '') : null;
    }
    return map;
}

/** Le date della UI (yyyy-MM-dd) nel formato datetime che Klaviyo richiede. */
export function toKlaviyoTimeframe(dateFrom: string, dateTo: string): Timeframe {
    return { start: `${dateFrom}T00:00:00Z`, end: `${dateTo}T23:59:59Z` };
}

/** I preset Windsor (`last_30d`) nei preset di Klaviyo. */
export function presetToKlaviyoTimeframe(preset: string): Timeframe {
    const m = /^last_(\d+)d$/.exec(preset);
    const days = m ? parseInt(m[1], 10) : 30;
    const allowed = [7, 30, 90, 365];
    const nearest = allowed.reduce((a, b) => (Math.abs(b - days) < Math.abs(a - days) ? b : a));
    return { key: `last_${nearest}_days` };
}
