/**
 * lib/kpi-compute.ts
 *
 * Dai report delle piattaforme ai KPI di UN cliente per UN mese, con il confronto sul mese scorso e sullo stesso mese
 * dell'anno scorso, il verdetto e i segnali «da guardare». Solo funzioni pure: niente rete, niente Firestore, così si
 * provano con dati finti (lib/__tests__/kpi-compute.test.ts). Chi legge le piattaforme è lib/kpi-monthly.ts.
 *
 * Regole che tengono onesto il numero (stesse di lib/client-health.ts):
 *  - «assente» non è zero: un KPI senza fonte o senza dato resta `null` e la mail dice perché, non scrive 0;
 *  - un confronto si fa solo fra cose dello stesso tipo: un dato reale (inserito a mano) non si confronta con una stima
 *    (lead Meta) del mese prima, altrimenti il «+40%» è il delta di due grandezze diverse;
 *  - sotto 10 eventi una percentuale non significa nulla (da 3 a 2 lead è −33%): si dà la differenza assoluta e il verdetto
 *    resta «dati insufficienti»;
 *  - i ricavi non si sommano fra fonti (GA4, Awin, Klaviyo contano lo stesso euro): vince la più ampia, in ordine.
 */

import type { PlatformReport } from './reporting';
import { KPI_CATALOG, type KpiProfile, type KpiUnit } from './kpi-profiles';
import { MIN_BASE_CONVERSIONS, NEUTRAL_BAND_PCT } from './client-health';

/* ───────────── mesi ───────────── */

export interface DateRange { dateFrom: string; dateTo: string }

const pad = (n: number) => String(n).padStart(2, '0');

/** «2026-10» spostato di `delta` mesi (negativo = indietro). */
export function shiftMonth(month: string, delta: number): string {
    const [y, m] = month.split('-').map(Number);
    const idx = y * 12 + (m - 1) + delta;
    return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

/** Primo e ultimo giorno del mese (yyyy-MM-dd). L'ultimo è incluso: Windsor, GA4 e Search Console lo leggono inclusivo. */
export function monthRange(month: string): DateRange {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { dateFrom: `${y}-${pad(m)}-01`, dateTo: `${y}-${pad(m)}-${pad(last)}` };
}

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export function monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return `${MESI[m - 1]} ${y}`;
}

/* ───────────── lettura dei report ───────────── */

type Which = 'current' | 'previous';
type Platform = PlatformReport['platform'];

function entries(platforms: PlatformReport[], platform: Platform) {
    return platforms.filter((p) => p.platform === platform && p.connected);
}

/** Somma un campo su tutte le righe e le voci (GBP: una per sede) di una piattaforma; null se non compare da nessuna parte. */
function readSum(platforms: PlatformReport[], platform: Platform, fields: string | string[], which: Which): number | null {
    const names = Array.isArray(fields) ? fields : [fields];
    let total = 0, seen = false;
    for (const p of entries(platforms, platform)) {
        for (const row of (which === 'current' ? p.rows : p.previousRows) ?? []) {
            for (const f of names) {
                const v = row?.[f];
                if (typeof v === 'number' && Number.isFinite(v)) { total += v; seen = true; }
            }
        }
    }
    return seen ? total : null;
}

/** Media fra le voci (valutazione di più sedi): una media non si somma. */
function readMean(platforms: PlatformReport[], platform: Platform, field: string, which: Which): number | null {
    const vals: number[] = [];
    for (const p of entries(platforms, platform)) {
        for (const row of (which === 'current' ? p.rows : p.previousRows) ?? []) {
            const v = row?.[field];
            if (typeof v === 'number' && Number.isFinite(v) && v > 0) vals.push(v);
        }
    }
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

const div = (a: number | null, b: number | null): number | null => (a === null || b === null || b <= 0 ? null : a / b);
const add = (...xs: (number | null)[]): number | null => {
    const v = xs.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) : null;
};

/* ───────────── un KPI, un mese ───────────── */

export type ManualMonth = Record<string, number> | undefined;

interface Raw { value: number | null; kind: 'real' | 'proxy' | null; proxyOf?: string }

/** Le piattaforme necessarie a un elenco di KPI: leggere solo quelle risparmia chiamate (e tempo, e il limite di Klaviyo). */
export function platformsNeeded(kpiIds: string[]): Set<Platform> {
    const need = new Set<Platform>();
    const has = (id: string) => kpiIds.includes(id);
    if (has('leads_real') || has('leads_meta') || has('cost_per_lead') || has('ads_spend') || has('roas') || has('cpa')) need.add('facebook');
    if (has('ads_spend') || has('roas') || has('cpa')) need.add('google_ads');
    if (has('sessions') || has('revenue') || has('orders') || has('conversion_rate') || has('roas') || has('cpa')) need.add('ga4');
    if (has('revenue') || has('orders')) { need.add('awin'); need.add('klaviyo'); }
    if (has('email_revenue')) need.add('klaviyo');
    if (has('search_clicks')) need.add('searchconsole');
    if (has('gbp_calls') || has('gbp_directions') || has('review_rating') || has('review_count')) need.add('gbp');
    if (has('social_reach') || has('followers') || has('profile_views')) { need.add('instagram'); need.add('facebook_page'); }
    if (has('linkedin_impr') || has('linkedin_follow')) need.add('linkedin_organic');
    return need;
}

/** Spesa pubblicitaria totale: Meta + Google Ads (canali diversi, non si contano due volte). */
const adsSpend = (p: PlatformReport[], w: Which) => add(readSum(p, 'facebook', 'spend', w), readSum(p, 'google_ads', 'cost', w));

/** Ricavi: la fonte più ampia disponibile, mai la somma. */
function revenue(p: PlatformReport[], w: Which): number | null {
    for (const [platform, field] of [['ga4', 'purchase_revenue'], ['awin', 'sale_amount'], ['klaviyo', 'conversion_value']] as const) {
        const v = readSum(p, platform, field, w);
        if ((v ?? 0) > 0) return v;
    }
    return readSum(p, 'ga4', 'purchase_revenue', w);
}

/** Ordini: transazioni GA4, altrimenti Awin. */
function orders(p: PlatformReport[], w: Which): number | null {
    for (const [platform, field] of [['ga4', 'transactions'], ['awin', 'transactions']] as const) {
        const v = readSum(p, platform, field, w);
        if ((v ?? 0) > 0) return v;
    }
    return readSum(p, 'ga4', 'transactions', w);
}

/**
 * Il valore di un KPI in un mese. `manual` sono i dati reali di QUEL mese. Per i KPI che hanno un dato reale e un ripiego
 * (lead), se il dato reale manca si torna al proxy di piattaforma e lo si dichiara (`kind: 'proxy'`).
 */
export function rawKpi(id: string, platforms: PlatformReport[], which: Which, manual: ManualMonth): Raw {
    const m = (field: string): number | null => (manual && typeof manual[field] === 'number' ? manual[field] : null);
    const real = (value: number | null): Raw => ({ value, kind: value === null ? null : 'real' });
    switch (id) {
        case 'leads_real': {
            const v = m('leads_real');
            if (v !== null) return { value: v, kind: 'real' };
            const proxy = readSum(platforms, 'facebook', 'leads', which);
            return proxy === null ? { value: null, kind: null } : { value: proxy, kind: 'proxy', proxyOf: 'Lead Meta' };
        }
        case 'appointments': return real(m('appointments'));
        case 'test_drives': return real(m('test_drives'));
        case 'sales': return real(m('sales'));
        case 'leads_meta': return real(readSum(platforms, 'facebook', 'leads', which));
        case 'cost_per_lead': return real(div(readSum(platforms, 'facebook', 'spend', which), readSum(platforms, 'facebook', 'leads', which)));
        case 'ads_spend': return real(adsSpend(platforms, which));
        // ROAS e costo per acquisto sono «misti»: fatturato (o ordini) del SITO diviso la spesa di TUTTI i canali a pagamento.
        case 'roas': return real(div(readSum(platforms, 'ga4', 'purchase_revenue', which), adsSpend(platforms, which)));
        case 'cpa': return real(div(adsSpend(platforms, which), readSum(platforms, 'ga4', 'transactions', which)));
        case 'sessions': return real(readSum(platforms, 'ga4', 'sessions', which));
        case 'revenue': return real(revenue(platforms, which));
        case 'orders': { const v = m('orders'); return v !== null ? { value: v, kind: 'real' } : real(orders(platforms, which)); }
        case 'conversion_rate': {
            const r = div(readSum(platforms, 'ga4', 'transactions', which), readSum(platforms, 'ga4', 'sessions', which));
            return real(r === null ? null : r * 100);
        }
        case 'email_revenue': return real(readSum(platforms, 'klaviyo', 'conversion_value', which));
        case 'search_clicks': return real(readSum(platforms, 'searchconsole', 'clicks', which));
        case 'gbp_calls': return real(readSum(platforms, 'gbp', 'call_clicks', which));
        case 'gbp_directions': return real(readSum(platforms, 'gbp', 'direction_requests', which));
        case 'review_rating': return real(readMean(platforms, 'gbp', 'review_average_rating_total', which));
        case 'review_count': return real(readSum(platforms, 'gbp', 'review_count', which));
        case 'social_reach': {
            const ig = readSum(platforms, 'instagram', 'reach', which);
            return real(ig !== null ? ig : readSum(platforms, 'facebook_page', 'page_impressions_unique', which));
        }
        case 'followers': return real(readSum(platforms, 'instagram', 'followers_count', which));
        case 'profile_views': return real(readSum(platforms, 'instagram', 'profile_views', which));
        case 'linkedin_impr': return real(readSum(platforms, 'linkedin_organic', 'account_analytics_impression_count', which));
        case 'linkedin_follow': return real(readSum(platforms, 'linkedin_organic', 'organization_follower_count', which));
        default: return { value: null, kind: null };
    }
}

/* ───────────── confronti ───────────── */

export interface Delta {
    kind: 'pct' | 'abs';
    value: number;
    tone: 'good' | 'bad' | 'neutral';
    /** Base troppo piccola per un giudizio (sotto 10 eventi su entrambi i lati). */
    small: boolean;
}

/** Quanto è cambiato un KPI rispetto a una base. null se un lato manca. */
export function compareDelta(cur: number | null, base: number | null, unit: KpiUnit, better: 'up' | 'down'): Delta | null {
    if (cur === null || base === null) return null;
    const toneOf = (sign: number): Delta['tone'] => (sign === 0 ? 'neutral' : (sign > 0) === (better === 'up') ? 'good' : 'bad');

    if (unit === 'rating') {
        const d = Math.round((cur - base) * 100) / 100;
        return { kind: 'abs', value: d, tone: Math.abs(d) < 0.05 ? 'neutral' : toneOf(d), small: false };
    }
    const smallBase = unit === 'int' && Math.max(cur, base) < MIN_BASE_CONVERSIONS;
    if (unit === 'int' && (base < MIN_BASE_CONVERSIONS || base === 0)) {
        const d = cur - base;
        return { kind: 'abs', value: d, tone: smallBase ? 'neutral' : toneOf(d), small: smallBase };
    }
    if (base === 0) {
        return cur === 0 ? { kind: 'pct', value: 0, tone: 'neutral', small: false } : { kind: 'abs', value: cur, tone: toneOf(cur), small: false };
    }
    const pct = ((cur - base) / base) * 100;
    return { kind: 'pct', value: pct, tone: Math.abs(pct) < NEUTRAL_BAND_PCT ? 'neutral' : toneOf(pct), small: false };
}

/* ───────────── formattazione ───────────── */

// useGrouping 'always': in italiano Intl non raggruppa i numeri a 4 cifre («1234»), e in una mail 1234 e 12.345 stonano
const nf0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' });
const nf1 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: 'always' });
const nf2 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });

export function formatValue(v: number | null, unit: KpiUnit): string {
    if (v === null) return '—';
    switch (unit) {
        case 'eur': return `${(Math.abs(v) < 100 ? nf2 : nf0).format(v)} €`;
        case 'ratio': return `${nf1.format(v)}x`;
        case 'pct': return `${nf1.format(v)}%`;
        case 'rating': return nf2.format(v);
        default: return nf0.format(v);
    }
}

export function formatDelta(d: Delta | null, unit: KpiUnit): string {
    if (!d) return '—';
    const sign = d.value > 0 ? '+' : d.value < 0 ? '−' : '';
    const abs = Math.abs(d.value);
    if (d.kind === 'pct') return `${sign}${(abs < 10 ? nf1 : nf0).format(abs)}%`;
    if (unit === 'rating') return `${sign}${nf2.format(abs)}`;
    return `${sign}${(unit === 'eur' ? formatValue(abs, 'eur') : nf0.format(abs))}`;
}

/* ───────────── un cliente, un mese ───────────── */

export interface KpiResult {
    id: string;
    label: string;
    unit: KpiUnit;
    better: 'up' | 'down';
    value: number | null;
    /** `proxy` = stima di piattaforma al posto del dato reale che manca. */
    kind: 'real' | 'proxy' | null;
    proxyOf?: string;
    previous: number | null;
    yoy: number | null;
    vsPrev: Delta | null;
    vsYoy: Delta | null;
    /** Perché non c'è il valore (mostrato al posto del numero). */
    missing?: string;
}

export type VerdictState = 'up' | 'flat' | 'down' | 'unknown';

export interface Verdict { state: VerdictState; headline: string }

export interface ClientMonthly {
    clientId: string;
    name: string;
    profile: KpiProfile;
    month: string;
    kpis: KpiResult[];
    verdict: Verdict;
    /** Da 0 a 3 segnali da guardare. */
    alerts: string[];
}

export interface ComputeInput {
    clientId: string;
    name: string;
    profile: KpiProfile;
    kpiIds: string[];
    month: string;
    /** Report del mese: `rows` = mese, `previousRows` = mese precedente. */
    main: PlatformReport[];
    /** Report dello stesso mese dell'anno scorso: `rows` = quel mese. */
    yoy: PlatformReport[];
    manual: { current?: Record<string, number>; previous?: Record<string, number>; yoy?: Record<string, number> };
    /** Fonti che dovevano rispondere e non l'hanno fatto, per dirlo invece di mostrare un buco. */
    failedSources?: string[];
}

const MANUAL_IDS = ['leads_real', 'appointments', 'test_drives', 'sales'];
export const SOURCE_NAMES: Partial<Record<Platform, string>> = {
    facebook: 'Meta Ads', google_ads: 'Google Ads', ga4: 'sito (GA4)', gbp: 'Google Maps', instagram: 'Instagram', facebook_page: 'Facebook',
    linkedin_organic: 'LinkedIn', klaviyo: 'Klaviyo', searchconsole: 'Search Console', awin: 'Awin', tiktok: 'TikTok',
};

export function computeClientMonthly(input: ComputeInput): ClientMonthly {
    const { main, yoy, manual } = input;
    const connected = new Set<Platform>(main.filter((p) => p.connected).map((p) => p.platform));

    const kpis: KpiResult[] = input.kpiIds.filter((id) => KPI_CATALOG[id]).map((id) => {
        const def = KPI_CATALOG[id];
        const cur = rawKpi(id, main, 'current', manual.current);
        const prev = rawKpi(id, main, 'previous', manual.previous);
        const year = rawKpi(id, yoy, 'current', manual.yoy);
        // Si confronta solo lo stesso tipo di dato: reale con reale, stima con stima
        const same = (a: Raw, b: Raw) => a.value !== null && b.value !== null && a.kind === b.kind;
        const result: KpiResult = {
            id, label: def.label, unit: def.unit, better: def.better,
            value: cur.value, kind: cur.kind, ...(cur.proxyOf ? { proxyOf: cur.proxyOf } : {}),
            previous: prev.value, yoy: year.value,
            vsPrev: same(cur, prev) ? compareDelta(cur.value, prev.value, def.unit, def.better) : null,
            vsYoy: same(cur, year) ? compareDelta(cur.value, year.value, def.unit, def.better) : null,
        };
        if (cur.value === null) {
            result.missing = MANUAL_IDS.includes(id) ? 'Dato non inserito' : 'Nessun dato nel mese';
        }
        return result;
    });

    return { clientId: input.clientId, name: input.name, profile: input.profile, month: input.month, kpis, verdict: verdictOf(kpis), alerts: alertsOf(input, kpis, connected) };
}

/** Il verdetto lo dà il primo KPI della lista (il principale) che si può confrontare con un giudizio sensato. */
export function verdictOf(kpis: KpiResult[]): Verdict {
    const withValue = kpis.filter((k) => k.value !== null);
    if (withValue.length === 0) return { state: 'unknown', headline: 'Dati insufficienti: nessun KPI ha un valore nel mese.' };
    const judged = kpis.find((k) => k.vsPrev && !k.vsPrev.small);
    if (!judged || !judged.vsPrev) return { state: 'unknown', headline: 'Dati insufficienti: numeri troppo bassi o senza mese di confronto per un giudizio.' };
    const state: VerdictState = judged.vsPrev.tone === 'good' ? 'up' : judged.vsPrev.tone === 'bad' ? 'down' : 'flat';
    const word = state === 'up' ? 'In crescita' : state === 'down' ? 'In calo' : 'Stabile';
    const proxy = judged.kind === 'proxy' ? ` (stima: ${judged.proxyOf})` : '';
    return { state, headline: `${word}: ${judged.label.toLowerCase()}${proxy} ${formatValue(judged.value, judged.unit)}, ${formatDelta(judged.vsPrev, judged.unit)} sul mese scorso.` };
}

/** Fino a 3 segnali concreti, in ordine di gravità. */
function alertsOf(input: ComputeInput, kpis: KpiResult[], connected: Set<Platform>): string[] {
    const out: string[] = [];
    const get = (id: string) => kpis.find((k) => k.id === id);

    // Fonti che dovevano rispondere e non l'hanno fatto: il numero mancante non è «zero»
    if (input.failedSources?.length) out.push(`Fonti che non hanno risposto: ${input.failedSources.join(', ')}.`);

    // Soldi spesi, niente risultati
    const spend = get('ads_spend')?.value ?? null;
    const leads = get('leads_real') ?? get('leads_meta');
    if (spend !== null && spend > 0 && leads && leads.value === 0) out.push(`Spesa pubblicitaria di ${formatValue(spend, 'eur')} senza ${leads.label.toLowerCase()}.`);

    // Costi che salgono molto
    for (const k of kpis) {
        if (k.better === 'down' && k.vsPrev?.kind === 'pct' && k.vsPrev.tone === 'bad' && k.vsPrev.value >= 25) {
            out.push(`${k.label} in aumento: ${formatDelta(k.vsPrev, k.unit)} sul mese scorso.`);
        }
    }

    // Dato reale mancante: la mail lo dice invece di far passare la stima per un dato vero
    const wantsManual = input.kpiIds.filter((id) => MANUAL_IDS.includes(id));
    const proxied = kpis.filter((k) => k.kind === 'proxy');
    if (proxied.length) out.push(`Dato reale non inserito: ${proxied.map((k) => k.label.toLowerCase()).join(', ')} stimati con ${proxied[0].proxyOf}.`);
    else {
        const noReal = wantsManual.filter((id) => get(id)?.value === null).map((id) => KPI_CATALOG[id].label.toLowerCase());
        if (noReal.length) out.push(`Dati reali non inseriti: ${noReal.join(', ')}.`);
    }

    // Fonti che servono ai KPI ma non sono collegate
    const need = platformsNeeded(input.kpiIds);
    const missingSrc = Array.from(need).filter((p) => !connected.has(p) && !input.failedSources?.includes(SOURCE_NAMES[p] ?? p));
    const allEmpty = kpis.every((k) => k.value === null);
    if (allEmpty && missingSrc.length === need.size && need.size > 0 && !out.length) out.push('Nessuna fonte collegata per i KPI di questo profilo.');

    return out.slice(0, 3);
}
