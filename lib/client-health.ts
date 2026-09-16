/**
 * lib/client-health.ts
 *
 * Il verdetto che sta accanto al nome del cliente: una faccia, un numero, e il
 * perché al click.
 *
 * Misura UNA cosa sola: il risultato — come vanno le metriche di esito
 * rispetto al periodo precedente. Setup Ads, punteggio SEO e impression share
 * NON entrano nel voto: entrano nella spiegazione, come possibili cause.
 *
 * Sono grandezze diverse e mediarle produce il caso peggiore che questo badge
 * possa produrre: setup 90, SEO 85, fatturato −40%, media verde. Un badge che
 * rassicura mentre il cliente perde soldi lo si guarda una volta, scopre che
 * ha mentito, e non lo si guarda più.
 *
 * Due regole tengono onesto il numero.
 *
 * 1. I ricavi NON si sommano tra le fonti. GA4 registra il fatturato del sito,
 *    Klaviyo quello che attribuisce alle email, Awin quello degli affiliati:
 *    gli ultimi due sono sottoinsiemi del primo. Sommarli conta lo stesso euro
 *    due o tre volte e il delta che ne esce non è il delta di niente. Si
 *    prende una sola fonte, la più ampia disponibile, e si dice quale.
 *
 * 2. Sotto una base minima non si dà un voto. Un cliente che passa da 3 a 2
 *    conversioni è a −33% e non significa nulla. In quel caso lo stato è
 *    `unknown` e il badge dice "dati insufficienti" — mai una faccia
 *    inventata.
 */

import type { PlatformReport } from './reporting';

export type HealthState = 'up' | 'flat' | 'down' | 'unknown';

/** Oltre questa soglia in percentuale la variazione conta come crescita o calo. */
export const NEUTRAL_BAND_PCT = 10;

/**
 * Base minima di conversioni nel periodo precedente perché una variazione
 * percentuale abbia senso. La soglia vale sul numero di eventi, non sui
 * ricavi: 500 € sono molti per un cliente e niente per un altro, mentre "dieci
 * conversioni" è una base piccola per chiunque.
 */
export const MIN_BASE_CONVERSIONS = 10;

export interface HealthReason {
    id: 'trend' | 'ads_setup' | 'seo' | 'impression_share';
    label: string;
    detail: string;
    tone: 'good' | 'warn' | 'bad' | 'neutral';
}

export interface ClientHealth {
    state: HealthState;
    /** Variazione percentuale sulla metrica di esito. null quando lo stato è 'unknown'. */
    deltaPct: number | null;
    /**
     * Differenza assoluta, usata quando la base precedente è troppo piccola
     * perché una percentuale significhi qualcosa. Vedi `deltaKind`.
     */
    deltaAbs: number | null;
    /**
     * Come va letto il numero nel badge. 'pct' è il caso normale; 'abs' è il
     * cliente passato da 3 a 184 conversioni, dove +6.033% sarebbe vero e
     * inutile insieme.
     */
    deltaKind: 'pct' | 'abs' | null;
    metric: 'revenue' | 'conversions' | null;
    /** Come chiamarla nella UI: "fatturato", "conversioni". */
    metricLabel: string | null;
    /** Da dove viene il numero, per poterlo dichiarare invece di farlo apparire. */
    source: string | null;
    periodLabel: string;
    current: number | null;
    previous: number | null;
    /** Perché non si può giudicare. Valorizzato solo quando lo stato è 'unknown'. */
    blocked: string | null;
    reasons: HealthReason[];
}

export interface PressureSummary {
    impressionShare: number | null;
    rankLost: number;
    budgetLost: number;
    diagnosi: 'competitor' | 'budget' | 'nessuna';
}

/**
 * Somma un campo su tutte le righe di una piattaforma. Windsor e i fetcher
 * nativi restituiscono a volte una riga sola e a volte molte, ognuna con solo
 * il sottoinsieme di campi che quella tabella conosce: leggere rows[0]
 * leggerebbe una riga quasi vuota. Vedi la nota in lib/reporting.ts.
 *
 * Restituisce null — non 0 — quando il campo non compare da nessuna parte: un
 * campo assente e un campo a zero portano a due verdetti diversi.
 */
function sumField(
    platforms: PlatformReport[],
    platform: PlatformReport['platform'],
    field: string,
    which: 'current' | 'previous'
): number | null {
    const p = platforms.find((x) => x.platform === platform && x.connected);
    if (!p) return null;
    const rows = which === 'current' ? p.rows : p.previousRows ?? [];
    let total = 0;
    let seen = false;
    for (const row of rows ?? []) {
        const v = row?.[field];
        if (typeof v === 'number' && Number.isFinite(v)) {
            total += v;
            seen = true;
        }
    }
    return seen ? total : null;
}

interface Source {
    platform: PlatformReport['platform'];
    field: string;
    label: string;
}

/** In ordine di ampiezza: la prima disponibile vince, le altre si ignorano. */
const REVENUE_SOURCES: Source[] = [
    { platform: 'ga4', field: 'purchase_revenue', label: 'GA4 — fatturato del sito' },
    { platform: 'awin', field: 'sale_amount', label: 'Awin — vendite affiliazione' },
    { platform: 'klaviyo', field: 'conversion_value', label: 'Klaviyo — fatturato attribuito alle email' },
];

const CONVERSION_SOURCES: Source[] = [
    { platform: 'ga4', field: 'transactions', label: 'GA4 — transazioni' },
    { platform: 'ga4', field: 'conversions', label: 'GA4 — eventi chiave' },
    { platform: 'google_ads', field: 'conversions', label: 'Google Ads — conversioni' },
    { platform: 'klaviyo', field: 'conversions', label: 'Klaviyo — conversioni' },
    { platform: 'awin', field: 'transactions', label: 'Awin — transazioni' },
];

/** Le piattaforme da cui può venire una metrica di esito, per nome leggibile. */
const OUTCOME_PLATFORMS: Partial<Record<PlatformReport['platform'], string>> = {
    ga4: 'GA4',
    google_ads: 'Google Ads',
    klaviyo: 'Klaviyo',
    awin: 'Awin',
};

interface Picked extends Source {
    current: number | null;
    previous: number | null;
}

function pick(platforms: PlatformReport[], sources: Source[]): Picked | null {
    for (const s of sources) {
        const current = sumField(platforms, s.platform, s.field, 'current');
        const previous = sumField(platforms, s.platform, s.field, 'previous');
        if ((current ?? 0) > 0 || (previous ?? 0) > 0) return { ...s, current, previous };
    }
    return null;
}

const nf = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });

function fmtValue(n: number, metric: 'revenue' | 'conversions'): string {
    return metric === 'revenue' ? `${nf.format(n)} €` : nf.format(n);
}

function pct(v: number): string {
    return `${(v * 100).toFixed(1).replace('.', ',')}%`;
}

/**
 * La causa "Setup Ads", isolata perché arriva da due strade diverse: la route
 * non la calcola (servirebbe rifetchare le campagne da Windsor, ~13s), mentre
 * la pagina cliente ha già `overallAdsHealth` in memoria e la aggiunge lì.
 */
export function adsSetupReason(score: number): HealthReason {
    return {
        id: 'ads_setup',
        label: 'Setup Ads',
        detail: `Health Score Ads ${score}/100, calcolato su conversioni, CTR e distribuzione del budget delle campagne attive.`,
        tone: score >= 70 ? 'good' : score >= 50 ? 'warn' : 'bad',
    };
}

export function computeClientHealth(input: {
    platforms: PlatformReport[];
    /** Ampiezza della finestra, per scrivere "vs 30 gg precedenti". */
    days: number;
    adsHealthOverall?: number | null;
    seoScore?: number | null;
    /** ISO dell'ultimo audit SEO: un punteggio di sei mesi fa non è "il" punteggio. */
    seoAuditAt?: string | null;
    pressure?: PressureSummary | null;
}): ClientHealth {
    const { platforms, days, adsHealthOverall, seoScore, seoAuditAt, pressure } = input;
    const periodLabel = `vs ${days} gg precedenti`;

    const revenue = pick(platforms, REVENUE_SOURCES);
    const conversions = pick(platforms, CONVERSION_SOURCES);
    const outcome = revenue ?? conversions;
    const metric: 'revenue' | 'conversions' | null = revenue ? 'revenue' : conversions ? 'conversions' : null;
    const metricLabel = metric === 'revenue' ? 'fatturato' : metric === 'conversions' ? 'conversioni' : null;

    const base: Omit<ClientHealth, 'state' | 'deltaPct' | 'deltaAbs' | 'deltaKind' | 'blocked' | 'reasons'> = {
        metric,
        metricLabel,
        source: outcome?.label ?? null,
        periodLabel,
        current: outcome?.current ?? null,
        previous: outcome?.previous ?? null,
    };

    // Le cause valgono anche quando il voto non si può dare: se il badge è
    // grigio, aprirlo deve comunque dire qualcosa di utile.
    const causes = buildCauses({ adsHealthOverall, seoScore, seoAuditAt, pressure });

    const unknown = (blocked: string): ClientHealth => ({
        ...base,
        state: 'unknown',
        deltaPct: null,
        deltaAbs: null,
        deltaKind: null,
        blocked,
        reasons: causes,
    });

    if (!outcome || metric === null || metricLabel === null) {
        // Distinzione che su due account reali era sbagliata: "niente
        // collegato" e "collegato ma a zero" sono due situazioni diverse, e
        // dire la prima quando vale la seconda manda a cercare un problema di
        // configurazione che non c'è.
        const connected = platforms
            .filter((p) => p.connected && OUTCOME_PLATFORMS[p.platform])
            .map((p) => OUTCOME_PLATFORMS[p.platform] as string);
        if (connected.length > 0) {
            return unknown(
                `${connected.join(', ')} ${connected.length > 1 ? 'sono collegati' : 'è collegato'} ma non ${connected.length > 1 ? 'hanno' : 'ha'} registrato ricavi né conversioni, né in questi ${days} giorni né nei ${days} precedenti.`
            );
        }
        return unknown(
            'Nessuna metrica di esito collegata. Serve almeno GA4, Google Ads, Klaviyo o Awin per sapere come sta andando questo cliente.'
        );
    }
    if (outcome.previous === null) {
        return unknown(
            `Manca il periodo di confronto: la fonte (${outcome.label}) non ha risposto per i ${days} giorni precedenti.`
        );
    }

    const previous = outcome.previous;
    const current = outcome.current ?? 0;

    // Il cancello sul volume guarda sempre le conversioni, anche quando il voto
    // è sul fatturato: è il numero di eventi a dire se la percentuale è segnale
    // o rumore. Se le conversioni non sono tracciate affatto non si blocca —
    // non si può pretendere una base che il cliente non misura.
    const convPrev = conversions?.previous ?? null;
    const convCur = conversions?.current ?? null;
    const baseTooSmall = previous === 0 || (convPrev !== null && convPrev < MIN_BASE_CONVERSIONS);

    let deltaPct: number | null = null;
    let deltaAbs: number | null = null;
    let deltaKind: 'pct' | 'abs';
    let state: HealthState;

    if (baseTooSmall) {
        // Su base minuscola la percentuale è inservibile: un cliente reale
        // passato da 3 a 184 conversioni darebbe +6.033%, un numero vero e
        // inutile insieme. Ma il cambiamento c'è, ed etichettarlo "dati
        // insufficienti" sarebbe l'errore opposto. Quando il periodo corrente
        // supera la base minima si dà il verdetto sulla differenza assoluta.
        const nowHasVolume =
            convCur !== null ? convCur >= MIN_BASE_CONVERSIONS : previous === 0 && current > 0;
        if (!nowHasVolume) {
            if (previous === 0) {
                return unknown(
                    `Nel periodo precedente ${metricLabel} era a zero e in questo non c'è ancora volume: non c'è nulla da confrontare.`
                );
            }
            return unknown(
                `Solo ${nf.format(convPrev as number)} conversioni nei ${days} giorni precedenti: sotto ${MIN_BASE_CONVERSIONS} una variazione percentuale è rumore, non andamento.`
            );
        }
        deltaAbs = Math.round((current - previous) * 100) / 100;
        deltaKind = 'abs';
        state = deltaAbs > 0 ? 'up' : deltaAbs < 0 ? 'down' : 'flat';
    } else {
        deltaPct = Math.round(((current - previous) / previous) * 1000) / 10;
        deltaAbs = Math.round((current - previous) * 100) / 100;
        deltaKind = 'pct';
        state = Math.abs(deltaPct) <= NEUTRAL_BAND_PCT ? 'flat' : deltaPct > 0 ? 'up' : 'down';
    }

    const verdict = state === 'up' ? 'in crescita' : state === 'down' ? 'in calo' : 'stabile';
    const nota =
        deltaKind === 'abs'
            ? ` La base precedente è troppo piccola per una percentuale, quindi il badge mostra la differenza.`
            : '';

    const trend: HealthReason = {
        id: 'trend',
        label: `Andamento ${metricLabel}`,
        detail:
            `${fmtValue(current, metric)} contro ${fmtValue(previous, metric)} nei ${days} giorni precedenti` +
            ` — ${verdict}. Fonte: ${outcome.label}.${nota}`,
        tone: state === 'up' ? 'good' : state === 'down' ? 'bad' : 'neutral',
    };

    return { ...base, state, deltaPct, deltaAbs, deltaKind, blocked: null, reasons: [trend, ...causes] };
}

/**
 * Le tre possibili cause. Non votano: spiegano. Ognuna compare solo se il dato
 * esiste davvero — una riga "SEO: non disponibile" non aiuta nessuno.
 */
function buildCauses(input: {
    adsHealthOverall?: number | null;
    seoScore?: number | null;
    seoAuditAt?: string | null;
    pressure?: PressureSummary | null;
}): HealthReason[] {
    const out: HealthReason[] = [];
    const { adsHealthOverall, seoScore, seoAuditAt, pressure } = input;

    if (typeof adsHealthOverall === 'number') out.push(adsSetupReason(adsHealthOverall));

    if (typeof seoScore === 'number') {
        const when = seoAuditAt
            ? ` Misurato il ${new Date(seoAuditAt).toLocaleDateString('it-IT')}.`
            : '';
        out.push({
            id: 'seo',
            label: 'SEO e velocità del sito',
            detail: `Punteggio ${seoScore}/100 da Lighthouse sul sito del cliente.${when}`,
            tone: seoScore >= 80 ? 'good' : seoScore >= 50 ? 'warn' : 'bad',
        });
    }

    // Su un account senza impression nel periodo, rankLost e budgetLost sono
    // entrambi 0 e la frase che ne usciva ("nessuno dei due è il collo di
    // bottiglia") descriveva un equilibrio inesistente. Senza attività non si
    // dice niente.
    if (pressure && (pressure.impressionShare !== null || pressure.rankLost > 0 || pressure.budgetLost > 0)) {
        const { impressionShare, rankLost, budgetLost, diagnosi } = pressure;
        const quota =
            impressionShare !== null
                ? `Prendi il ${pct(impressionShare)} delle ricerche disponibili.`
                : 'Quota sulle ricerche non calcolabile: troppe campagne per cui Google dà solo "<10%" o ">90%".';
        const causa =
            diagnosi === 'competitor'
                ? ` Perdi più impression per posizionamento (${pct(rankLost)}) che per budget esaurito (${pct(budgetLost)}): alzare la spesa serve a poco se prima non migliorano offerte e pertinenza.`
                : diagnosi === 'budget'
                  ? ` Perdi più impression per budget esaurito (${pct(budgetLost)}) che per posizionamento (${pct(rankLost)}): qui il budget è il vincolo.`
                  : ` Posizionamento (${pct(rankLost)}) e budget (${pct(budgetLost)}) pesano allo stesso modo: nessuno dei due è il collo di bottiglia.`;
        out.push({
            id: 'impression_share',
            label: 'Pressione competitiva',
            detail: quota + causa,
            tone:
                diagnosi === 'competitor' ? (rankLost > 0.4 ? 'bad' : 'warn') : diagnosi === 'budget' ? 'warn' : 'neutral',
        });
    }

    return out;
}
