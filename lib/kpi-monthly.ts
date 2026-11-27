/**
 * lib/kpi-monthly.ts
 *
 * Legge le piattaforme di UN cliente per UN mese e ne ricava i KPI (lib/kpi-compute.ts), salvandone la «fotografia» su
 * Firestore. La mail del giorno 3 non rifà le letture: usa le fotografie, così un guasto di Windsor la mattina dell'invio
 * non la ferma e ogni cliente si calcola con la sua calma (una chiamata per cliente, entro i 60 secondi di Vercel).
 *
 * Tre finestre: il mese, il mese prima (nella stessa chiamata del report: `previous`) e lo stesso mese dell'anno scorso
 * (una chiamata a parte, senza confronto). Si leggono SOLO le piattaforme che servono ai KPI scelti per quel cliente:
 * una concessionaria con i KPI di default non scarica Klaviyo né LinkedIn, che sono le più lente e le più limitate.
 */

import { adminDb } from './firebase-admin';
import { getClientToken } from './api-auth';
import { getClientMarketingReport } from './reporting';
import { computeClientMonthly, platformsNeeded, shiftMonth, SOURCE_NAMES, type ClientMonthly, type DealerBreakdown } from './kpi-compute';
import { typesPresent } from './dealer-kpi/bridge';
import { isKpiProfile, kpiIdsForClient } from './kpi-profiles';
import { sitesOf } from './client-sites';
import { isMonthKey } from './manual-kpis';
import { readKpiOverrides } from './kpi-profiles-store';
import { readManualKpis, writeSnapshot } from './monthly-mail-store';
import { completedBlocks, computeWeeks, monthWindows, weekComparison, type WeekInput } from './kpi-weekly';
import { romeDateKey } from './monthly-mail-run';

/** Quante settimane si leggono insieme per un cliente: le fonti (Klaviyo in testa) hanno limiti di chiamate. */
const WEEK_CONCURRENCY = 2;

export type MonthlyOutcome =
    | { ok: true; result: ClientMonthly }
    | { ok: false; reason: 'not_found' | 'no_profile' | 'bad_month'; message: string };

export interface MonthOptions {
    /** Elenco di KPI al posto di quello del cliente (la pagina «KPI concessionario» ne mostra più di 5). */
    kpiIds?: string[];
    /** Settimana su settimana (di default sì: serve alla mail). */
    weeks?: boolean;
    /** Salva la fotografia per la mail (di default sì). Chi guarda soltanto non deve sovrascriverla. */
    snapshot?: boolean;
    /** Confronto con l'anno scorso (di default sì: serve alla mail). È una lettura in più delle piattaforme: la pagina del report, che mostra solo il mese prima, la salta. */
    yoy?: boolean;
}

/** Marca e provenienza del mese dallo Sheet del concessionario (clients/{id}/dealerKpi/{mese}); null se il mese non c'è. */
export async function readDealerBreakdown(clientId: string, month: string): Promise<DealerBreakdown | null> {
    const snap = await adminDb.collection('clients').doc(clientId).collection('dealerKpi').doc(month).get();
    if (!snap.exists) return null;
    const d = snap.data() as { totals?: { byBrand?: Record<string, Record<string, number>>; bySource?: Record<string, Record<string, number>> }; entries?: Array<{ type: string }> };
    const present = typesPresent(d.entries);
    const keep = (m: Record<string, Record<string, number>> | undefined) =>
        Object.fromEntries(Object.entries(m ?? {}).filter(([type, v]) => present.has(type) && v && Object.keys(v).length > 0));
    const out = { byBrand: keep(d.totals?.byBrand), bySource: keep(d.totals?.bySource) };
    return Object.keys(out.byBrand).length || Object.keys(out.bySource).length ? out : null;
}

/** Le fonti da leggere per un cliente, limitate alle piattaforme che i KPI scelti richiedono. */
async function buildSource(clientId: string, client: Record<string, any>, need: Set<string>) {
    // Klaviyo sta cifrato a parte: si chiede solo se serve
    let klaviyo: { apiKey: string; conversionMetricId?: string; cacheKey?: string } | undefined;
    if (need.has('klaviyo')) {
        const t = await getClientToken(clientId, 'klaviyo').catch(() => null);
        if (t?.accessToken) klaviyo = { apiKey: t.accessToken, conversionMetricId: t.extra?.conversionMetricId, cacheKey: clientId };
    }

    const w = client.windsorAccounts ?? {};
    return {
        metaAdAccountId: need.has('facebook') ? client.metaAdAccountId : undefined,
        metaCampaignFilter: need.has('facebook') ? client.metaCampaignFilter : undefined,
        googleAdAccountId: need.has('google_ads') ? client.googleAdAccountId : undefined,
        ga4PropertyId: need.has('ga4') ? client.ga4PropertyId : undefined,
        // Più siti: Analytics e Search Console di ciascuno, ma solo se i KPI scelti ne hanno bisogno
        sites: sitesOf(client).map((s) => ({ ...s, ga4PropertyId: need.has('ga4') ? s.ga4PropertyId : undefined, searchConsole: need.has('searchconsole') ? s.searchConsole : undefined })),
        awinAdvertiserId: need.has('awin') ? client.awinAdvertiserId : undefined,
        klaviyo,
        windsorAccounts: {
            instagram: need.has('instagram') ? w.instagram : undefined,
            facebook_page: need.has('facebook_page') ? w.facebook_page : undefined,
            linkedin_organic: need.has('linkedin_organic') ? w.linkedin_organic : undefined,
            gbp: need.has('gbp') ? w.gbp : undefined,
            searchconsole: need.has('searchconsole') ? w.searchconsole : undefined,
        },
    };

}

export async function computeClientMonth(clientId: string, month: string, opts: MonthOptions = {}): Promise<MonthlyOutcome> {
    const { weeks: withWeeks = true, snapshot = true, yoy: withYoy = true } = opts;
    if (!isMonthKey(month)) return { ok: false, reason: 'bad_month', message: 'Mese non valido.' };
    const today = romeDateKey(new Date());
    const windows = monthWindows(month, today);
    if (!windows) return { ok: false, reason: 'bad_month', message: 'Il mese non è ancora iniziato: serve almeno un giorno chiuso.' };

    const snap = await adminDb.collection('clients').doc(clientId).get();
    if (!snap.exists) return { ok: false, reason: 'not_found', message: 'Cliente non trovato.' };
    const client = snap.data() as Record<string, any>;
    if (!isKpiProfile(client.kpiProfile)) return { ok: false, reason: 'no_profile', message: 'Il cliente non ha un profilo KPI.' };

    const overrides = await readKpiOverrides();
    const kpiIds = opts.kpiIds ?? kpiIdsForClient(client, overrides) ?? [];
    const need = platformsNeeded(kpiIds);

    const source = await buildSource(clientId, client, need);

    const prevMonth = shiftMonth(month, -1);
    const yoyMonth = shiftMonth(month, -12);
    const [main, yoy, manual] = await Promise.all([
        getClientMarketingReport(source, 'last_30d', { current: windows.current, previous: windows.previous }),
        // L'anno scorso: una lettura a parte. Se fallisce non deve far cadere il mese: si perde solo quel confronto.
        !withYoy ? Promise.resolve([] as Awaited<ReturnType<typeof getClientMarketingReport>>) : getClientMarketingReport(source, 'last_30d', { current: windows.yoy, previous: null }).catch((e: any) => {
            console.error(`[kpi-monthly] ${clientId}: confronto anno scorso non disponibile:`, e?.message);
            return [];
        }),
        // I dati reali sono di mese intero: a mese in corso non si confrontano con i primi giorni (sarebbero grandezze diverse)
        windows.partial
            ? Promise.resolve({ current: undefined, previous: undefined, yoy: undefined })
            : Promise.all([month, prevMonth, yoyMonth].map((m) => readManualKpis([clientId], m).then((r) => r[clientId])))
                .then(([current, previous, yoyV]) => ({ current, previous, yoy: yoyV })),
    ]);

    // Le fonti che dovevano rispondere e non l'hanno fatto: si dicono, non si fanno passare per «zero»
    const failed = Array.from(new Set([...main, ...yoy].filter((p) => !p.connected).map((p) => SOURCE_NAMES[p.platform] ?? p.platform)));

    const result = computeClientMonthly({
        clientId, name: String(client.name ?? clientId), profile: client.kpiProfile, kpiIds, month, main, yoy, manual, failedSources: failed,
    });

    // Settimana su settimana: una lettura per ogni settimana chiusa, con la stessa settimana del mese prima. Una settimana che
    // non si legge non ferma il mese: resta «non disponibile» e il resto si vede.
    const blocks = withWeeks ? completedBlocks(month, today) : [];
    const weekInputs: WeekInput[] = new Array(blocks.length);
    let next = 0;
    const worker = async () => {
        for (let i = next++; i < blocks.length; i = next++) {
            const block = blocks[i];
            const prev = weekComparison(month, block.n);
            const reports = await getClientMarketingReport(source, 'last_30d', { current: block, previous: prev }).catch((e: any) => {
                console.error(`[kpi-monthly] ${clientId}: settimana ${block.n} non disponibile:`, e?.message);
                return null;
            });
            weekInputs[i] = { block, comparable: prev !== null, reports };
        }
    };
    await Promise.all(Array.from({ length: Math.min(WEEK_CONCURRENCY, blocks.length) }, worker));
    if (withWeeks) result.weeks = computeWeeks(kpiIds, weekInputs);
    if (windows.partial) result.partial = { days: windows.days };
    // Concessionari: il dettaglio per marca e provenienza dello Sheet, se il mese è stato compilato. Lo Sheet è di mese intero,
    // quindi si mostra anche a mese in corso (è ciò che il cliente ha scritto finora), senza entrare nei confronti.
    const dealer = await readDealerBreakdown(clientId, month).catch((e: any) => {
        console.error(`[kpi-monthly] ${clientId}: dettaglio marca/provenienza non disponibile:`, e?.message);
        return null;
    });
    if (dealer) result.dealer = dealer;

    if (snapshot) await writeSnapshot(month, result);
    return { ok: true, result };
}

/* ───────────── intervallo di giorni (la pagina del report) ───────────── */

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

const toUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromUtc = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = toUtc(iso); d.setUTCDate(d.getUTCDate() + n); return fromUtc(d); };
const daysBetween = (from: string, to: string) => Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000) + 1;
const isRealDate = (iso: string) => { if (!DATE_RE.test(iso)) return false; const d = toUtc(iso); return Number.isFinite(d.getTime()) && fromUtc(d) === iso; };
const lastDayOf = (month: string) => fromUtc(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)));

/** I mesi interi coperti da un intervallo, se l'intervallo inizia il giorno 1 e finisce l'ultimo giorno di un mese; altrimenti null. */
export function wholeMonthsOf(from: string, to: string): string[] | null {
    if (from.slice(8) !== '01' || to !== lastDayOf(to.slice(0, 7))) return null;
    const out: string[] = [];
    for (let m = from.slice(0, 7); m <= to.slice(0, 7); m = shiftMonth(m, 1)) out.push(m);
    return out;
}

/** Somma dei valori a mano/Sheet di più mesi (un campo manca se manca in tutti i mesi). */
function sumManual(list: (Record<string, number> | undefined)[]): Record<string, number> | undefined {
    const out: Record<string, number> = {};
    let any = false;
    for (const m of list) for (const [k, v] of Object.entries(m ?? {})) if (typeof v === 'number') { out[k] = (out[k] ?? 0) + v; any = true; }
    return any ? out : undefined;
}

/** I KPI che vengono dallo Sheet (o a mano): per mese, non per giorno. */
const SHEET_IDS = ['leads_real', 'appointments', 'test_drives', 'quotes', 'sales', 'cost_per_lead_total', 'cost_per_lead', 'cpl_google', 'cpl_meta_real'];
export const SHEET_RANGE_NOTE = 'Solo per mesi interi: lo Sheet del cliente è per mese';

export type RangeOutcome =
    | { ok: true; result: ClientMonthly; range: { from: string; to: string; days: number; previousFrom: string; previousTo: string; wholeMonths: string[] | null } }
    | { ok: false; reason: 'not_found' | 'no_profile' | 'bad_range'; message: string };

/**
 * I KPI di un cliente su un intervallo di giorni qualsiasi (fino a ieri, al massimo un anno), confrontati con l'intervallo
 * della stessa lunghezza subito prima. Le piattaforme si leggono per giorno; lo Sheet del cliente è per mese, quindi i suoi
 * KPI (lead, appuntamenti, preventivi, vendite, costo per lead) ci sono solo se l'intervallo è fatto di mesi interi.
 * Non salva nulla.
 */
export async function computeClientRange(clientId: string, from: string, to: string, opts: { kpiIds?: string[] } = {}): Promise<RangeOutcome> {
    if (!isRealDate(from) || !isRealDate(to)) return { ok: false, reason: 'bad_range', message: 'Date non valide (AAAA-MM-GG).' };
    if (from > to) return { ok: false, reason: 'bad_range', message: 'La data di inizio viene dopo quella di fine.' };
    const yesterday = addDays(romeDateKey(new Date()), -1);
    if (to > yesterday) to = yesterday;
    if (from > to) return { ok: false, reason: 'bad_range', message: 'Serve almeno un giorno chiuso: l\'intervallo può arrivare fino a ieri.' };
    const days = daysBetween(from, to);
    if (days > MAX_RANGE_DAYS) return { ok: false, reason: 'bad_range', message: 'Al massimo un anno di giorni.' };

    const snap = await adminDb.collection('clients').doc(clientId).get();
    if (!snap.exists) return { ok: false, reason: 'not_found', message: 'Cliente non trovato.' };
    const client = snap.data() as Record<string, any>;
    if (!isKpiProfile(client.kpiProfile)) return { ok: false, reason: 'no_profile', message: 'Il cliente non ha un profilo KPI.' };

    const overrides = await readKpiOverrides();
    const kpiIds = opts.kpiIds ?? kpiIdsForClient(client, overrides) ?? [];
    const need = platformsNeeded(kpiIds);
    const source = await buildSource(clientId, client, need);

    const previousTo = addDays(from, -1);
    const previousFrom = addDays(previousTo, -(days - 1));
    const wholeMonths = wholeMonthsOf(from, to);
    const prevMonths = wholeMonths ? wholeMonthsOf(previousFrom, previousTo) : null;

    const [main, manualCur, manualPrev] = await Promise.all([
        getClientMarketingReport(source, 'last_30d', { current: { dateFrom: from, dateTo: to }, previous: { dateFrom: previousFrom, dateTo: previousTo } }),
        wholeMonths ? Promise.all(wholeMonths.map((m) => readManualKpis([clientId], m).then((r) => r[clientId]))).then(sumManual) : Promise.resolve(undefined),
        prevMonths ? Promise.all(prevMonths.map((m) => readManualKpis([clientId], m).then((r) => r[clientId]))).then(sumManual) : Promise.resolve(undefined),
    ]);
    const failed = Array.from(new Set(main.filter((p) => !p.connected).map((p) => SOURCE_NAMES[p.platform] ?? p.platform)));

    const result = computeClientMonthly({
        clientId, name: String(client.name ?? clientId), profile: client.kpiProfile, kpiIds, month: from.slice(0, 7), main, yoy: [],
        manual: { current: manualCur, previous: manualPrev, yoy: undefined }, failedSources: failed,
    });
    if (!wholeMonths) {
        for (const k of result.kpis) if (k.value === null && SHEET_IDS.includes(k.id)) k.missing = SHEET_RANGE_NOTE;
    }
    return { ok: true, result, range: { from, to, days, previousFrom, previousTo, wholeMonths } };
}
