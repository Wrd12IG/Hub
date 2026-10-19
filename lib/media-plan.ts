// Piano media di un cliente: righe di investimento per mese/canale/linea e ipotesi di resa, da cui si ricavano riepilogo
// per canale e risultati attesi (lead, costo per lead, reach, click) in scenario base e prudente. Stessa logica del
// foglio "piano media" che l'agenzia prepara in Excel, ma qui i numeri si ricalcolano da soli. Funzioni pure, nessun React.

export type Channel = 'Meta' | 'Google' | 'Off line';
export const CHANNELS: Channel[] = ['Meta', 'Google', 'Off line'];

/** Linee note: dalla linea dipende come si stimano i risultati. Le linee Off line sono libere. */
export const META_KINDS = ['Warm-up', 'Lead', 'Closing'] as const;
export const GOOGLE_KINDS = ['Search', 'YT-DG', 'Remarketing'] as const;
export type MetaKind = (typeof META_KINDS)[number];

export interface PlanLine {
    id: string;
    /** yyyy-MM */
    month: string;
    channel: Channel;
    kind: string;
    description: string;
    amount: number;
}

export interface MetaPhase { cpm: number; frequency: number; ctr: number; /** Costo per lead atteso; 0 = la fase non raccoglie lead. */ cpl: number }

export interface PlanAssumptions {
    meta: Record<MetaKind, MetaPhase>;
    metaQualifiedShare: number;
    google: { cpcSearch: number; cvrSearch: number; cpmYtDg: number; ctrYtDg: number; cpcRemarketing: number; cvrRemarketing: number; qualifiedShare: number };
    /** Scenario prudente: moltiplica i lead (0,6 = il 40% in meno). */
    prudentFactor: number;
}

export interface MediaPlan { lines: PlanLine[]; assumptions: PlanAssumptions }

/** Valori di partenza prudenti di un piano concessionaria, da correggere con i dati reali del cliente. */
export const DEFAULT_ASSUMPTIONS: PlanAssumptions = {
    meta: {
        'Warm-up': { cpm: 4.25, frequency: 3, ctr: 0.03, cpl: 0 },
        Lead: { cpm: 6.5, frequency: 3.1, ctr: 0.016, cpl: 9.5 },
        Closing: { cpm: 5, frequency: 3, ctr: 0.02, cpl: 12 },
    },
    metaQualifiedShare: 0.35,
    google: { cpcSearch: 1.03, cvrSearch: 0.06, cpmYtDg: 9, ctrYtDg: 0.008, cpcRemarketing: 0.7, cvrRemarketing: 0.04, qualifiedShare: 0.6 },
    prudentFactor: 0.6,
};

export const emptyPlan = (): MediaPlan => ({ lines: [], assumptions: JSON.parse(JSON.stringify(DEFAULT_ASSUMPTIONS)) });

const div = (a: number, b: number) => (b > 0 ? a / b : 0);
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export interface PlanResults {
    leads: number;
    meta: number;
    google: number;
    qualified: number;
    /** Solo spesa ads (Meta + Google). */
    cplGross: number;
    cplQualified: number;
    /** Tutto il budget, off line compreso, sui lead qualificati. */
    cplAllBudget: number;
}

export interface PlanSummary {
    months: string[];
    byChannel: Record<Channel, Record<string, number>>;
    channelTotals: Record<Channel, number>;
    monthTotals: Record<string, number>;
    total: number;
    ads: number;
    adsShare: number;
    /** Reach delle linee Meta di warm-up (somma: conta più volte chi è raggiunto da più linee). */
    metaWarmupReach: number;
    searchClicks: number;
    base: PlanResults;
    prudent: PlanResults;
    /** Lead lordi attesi per mese (base): servono a confrontare il ritmo reale con il piano. */
    leadsByMonth: Record<string, number>;
}

function metaLine(l: PlanLine, a: PlanAssumptions) {
    const ph = a.meta[l.kind as MetaKind];
    if (!ph) return { impressions: 0, reach: 0, clicks: 0, leads: 0 };
    const impressions = div(l.amount, ph.cpm) * 1000;
    return { impressions, reach: div(impressions, ph.frequency), clicks: impressions * ph.ctr, leads: ph.cpl > 0 ? div(l.amount, ph.cpl) : 0 };
}

function googleLeads(l: PlanLine, a: PlanAssumptions): { leads: number; searchClicks: number } {
    const g = a.google;
    if (l.kind === 'Search') { const c = div(l.amount, g.cpcSearch); return { leads: c * g.cvrSearch, searchClicks: c }; }
    if (l.kind === 'Remarketing') return { leads: div(l.amount, g.cpcRemarketing) * g.cvrRemarketing, searchClicks: 0 };
    return { leads: 0, searchClicks: 0 }; // YouTube / Demand Gen: costruiscono pubblico, i lead non si attribuiscono
}

export function computePlan(plan: MediaPlan): PlanSummary {
    const a = plan.assumptions;
    const lines = plan.lines.filter((l) => /^\d{4}-\d{2}$/.test(l.month) && n(l.amount) > 0);
    const months = Array.from(new Set(lines.map((l) => l.month))).sort();
    const byChannel = Object.fromEntries(CHANNELS.map((c) => [c, Object.fromEntries(months.map((m) => [m, 0]))])) as PlanSummary['byChannel'];
    const leadsByMonth: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
    let metaLeads = 0, googleLeadsTot = 0, metaWarmupReach = 0, searchClicks = 0;

    for (const l of lines) {
        byChannel[l.channel][l.month] += l.amount;
        if (l.channel === 'Meta') {
            const r = metaLine(l, a);
            metaLeads += r.leads; leadsByMonth[l.month] += r.leads;
            if (l.kind === 'Warm-up') metaWarmupReach += r.reach;
        } else if (l.channel === 'Google') {
            const r = googleLeads(l, a);
            googleLeadsTot += r.leads; leadsByMonth[l.month] += r.leads; searchClicks += r.searchClicks;
        }
    }

    const channelTotals = Object.fromEntries(CHANNELS.map((c) => [c, Object.values(byChannel[c]).reduce((s, v) => s + v, 0)])) as Record<Channel, number>;
    const monthTotals = Object.fromEntries(months.map((m) => [m, CHANNELS.reduce((s, c) => s + byChannel[c][m], 0)]));
    const total = CHANNELS.reduce((s, c) => s + channelTotals[c], 0);
    const ads = channelTotals.Meta + channelTotals.Google;

    const results = (f: number): PlanResults => {
        const meta = metaLeads * f, google = googleLeadsTot * f;
        const qualified = (metaLeads * a.metaQualifiedShare + googleLeadsTot * a.google.qualifiedShare) * f;
        return { leads: meta + google, meta, google, qualified, cplGross: div(ads, meta + google), cplQualified: div(ads, qualified), cplAllBudget: div(total, qualified) };
    };

    return {
        months, byChannel, channelTotals, monthTotals, total, ads, adsShare: div(ads, total),
        metaWarmupReach, searchClicks, base: results(1), prudent: results(a.prudentFactor), leadsByMonth,
    };
}

// ── Import dal foglio Excel "Piano Media" ──

const MONTHS_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

const normalize = (v: unknown) => String(v ?? '').trim().toLowerCase();

/**
 * Legge le righe (array di array, come le dà xlsx) del foglio Piano Media: intestazioni DATA/Canale/Linea/INVESTIMENTO/MEZZI.
 * L'anno non è nel foglio per riga: si prende da `year` (di solito dal titolo, es. "Q4 2026").
 */
export function parsePlanRows(rows: unknown[][], year: number): { lines: PlanLine[]; skipped: number } {
    const headerIdx = rows.findIndex((r) => r.some((c) => normalize(c) === 'investimento') && r.some((c) => normalize(c) === 'canale'));
    if (headerIdx < 0) return { lines: [], skipped: 0 };
    const head = rows[headerIdx].map(normalize);
    const col = (name: string) => head.indexOf(name);
    const cMonth = col('data'), cAmount = col('investimento'), cChannel = col('canale'), cKind = col('linea'), cDesc = col('mezzi');
    const lines: PlanLine[] = [];
    let skipped = 0;
    for (const r of rows.slice(headerIdx + 1)) {
        const m = MONTHS_IT.indexOf(normalize(r[cMonth]));
        const amount = typeof r[cAmount] === 'number' ? (r[cAmount] as number) : Number(String(r[cAmount] ?? '').replace(',', '.'));
        const chan = CHANNELS.find((c) => normalize(c) === normalize(r[cChannel]));
        if (m < 0 || !chan || !Number.isFinite(amount) || amount <= 0) { if (r.some((c) => c !== undefined && c !== null && c !== '')) skipped++; continue; }
        lines.push({
            id: `imp-${lines.length}-${Date.now().toString(36)}`,
            month: `${year}-${String(m + 1).padStart(2, '0')}`,
            channel: chan,
            kind: String(r[cKind] ?? '').trim() || 'Altro',
            description: String(r[cDesc] ?? '').trim(),
            amount,
        });
    }
    return { lines, skipped };
}
