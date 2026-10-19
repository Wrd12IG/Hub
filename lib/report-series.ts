// Serie giornaliere del report e andamento calcolato da esse. Pura: nessun accesso a rete o a React.

export interface DailyPoint {
    /** yyyy-MM-dd */
    date: string;
    spend?: number;
    /** Il risultato del canale: lead di Meta, conversioni di Google Ads. */
    results?: number;
    clicks?: number;
    impressions?: number;
}

type Row = Record<string, unknown>;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
const dayOf = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '');

/** Righe giornaliere di Windsor (più righe per lo stesso giorno si sommano) → una serie ordinata per data. */
export function dailyFromRows(rows: Row[], map: { spend?: string; results?: string; clicks?: string; impressions?: string }): DailyPoint[] {
    const byDay = new Map<string, DailyPoint>();
    for (const r of rows) {
        const date = dayOf(r.date);
        if (!date) continue;
        const p = byDay.get(date) ?? { date };
        if (map.spend) p.spend = (p.spend ?? 0) + num(r[map.spend]);
        if (map.results) p.results = (p.results ?? 0) + num(r[map.results]);
        if (map.clicks) p.clicks = (p.clicks ?? 0) + num(r[map.clicks]);
        if (map.impressions) p.impressions = (p.impressions ?? 0) + num(r[map.impressions]);
        byDay.set(date, p);
    }
    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface TrendPoint {
    date: string;
    spend: number;
    results: number | null;
    /** Spesa del giorno / risultati del giorno (null se quel giorno non ci sono risultati). */
    costPerResult: number | null;
    /** Stesso rapporto su 7 giorni mobili: toglie il rumore dei giorni senza risultati. */
    costPerResult7d: number | null;
}

function addDays(iso: string, n: number): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

/**
 * Andamento giornaliero senza buchi: i giorni mancanti valgono zero (un giorno senza spesa è un dato, non un buco).
 * `series` è la serie del canale da cui viene il risultato; `extraSpend` è la spesa degli altri canali a pagamento.
 */
export function buildTrend(series: DailyPoint[], extraSpend: DailyPoint[] = [], withResults = true): TrendPoint[] {
    const all = [...series, ...extraSpend];
    if (all.length === 0) return [];
    const dates = all.map((p) => p.date).sort();
    const first = dates[0];
    const last = dates[dates.length - 1];

    const own = new Map(series.map((p) => [p.date, p]));
    const other = new Map(extraSpend.map((p) => [p.date, p]));

    const days: { date: string; spend: number; ownSpend: number; results: number }[] = [];
    for (let d = first; d <= last; d = addDays(d, 1)) {
        const o = own.get(d);
        days.push({ date: d, spend: (o?.spend ?? 0) + (other.get(d)?.spend ?? 0), ownSpend: o?.spend ?? 0, results: o?.results ?? 0 });
    }

    return days.map((day, i) => {
        const win = days.slice(Math.max(0, i - 6), i + 1);
        const spend7 = win.reduce((s, x) => s + x.ownSpend, 0);
        const res7 = win.reduce((s, x) => s + x.results, 0);
        return {
            date: day.date,
            spend: round2(day.spend),
            results: withResults ? day.results : null,
            costPerResult: withResults && day.results > 0 ? round2(day.ownSpend / day.results) : null,
            costPerResult7d: withResults && res7 > 0 ? round2(spend7 / res7) : null,
        };
    });
}

// ── Serie giornaliere con più metriche (una scheda di piattaforma = un grafico con le sue metriche) ──

export type MetricRow = { date: string } & Record<string, number | string>;

/**
 * Come leggere una colonna giornaliera: `sum` somma le righe dello stesso giorno (impression, click…);
 * `last` tiene l'ultimo valore del giorno (i totali che sono uno stato, come i follower: sommarli li raddoppierebbe).
 */
export type DailyFieldMap = Record<string, { field: string; mode?: 'sum' | 'last' }>;

/** Righe giornaliere grezze (Windsor) → una riga per giorno con le chiavi del report, ordinata per data. */
export function metricRowsFromRows(rows: Record<string, unknown>[], map: DailyFieldMap): MetricRow[] {
    const byDay = new Map<string, MetricRow>();
    for (const r of rows) {
        const date = dayOf(r.date);
        if (!date) continue;
        const row = byDay.get(date) ?? ({ date } as MetricRow);
        for (const [key, { field, mode = 'sum' }] of Object.entries(map)) {
            const v = r[field];
            if (typeof v !== 'number' || !Number.isFinite(v)) continue;
            row[key] = mode === 'last' ? v : ((row[key] as number | undefined) ?? 0) + v;
        }
        byDay.set(date, row);
    }
    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/** Le serie dei canali a pagamento (spesa, risultato, click, impression) nel formato delle schede. */
export function metricRowsFromSeries(platform: 'facebook' | 'google_ads', series: DailyPoint[]): MetricRow[] {
    const spendKey = platform === 'facebook' ? 'spend' : 'cost';
    const resultKey = platform === 'facebook' ? 'leads' : 'conversions';
    return series.map((p) => {
        const row = { date: p.date } as MetricRow;
        if (p.spend !== undefined) row[spendKey] = round2(p.spend);
        if (p.results !== undefined) row[resultKey] = round2(p.results);
        if (p.clicks !== undefined) row.clicks = p.clicks;
        if (p.impressions !== undefined) row.impressions = p.impressions;
        return row;
    });
}

/** Aggiunge a ogni riga la somma di più colonne (es. contatti GBP = chiamate + indicazioni + click sul sito). */
export function withSumColumn(rows: MetricRow[], target: string, parts: string[]): MetricRow[] {
    return rows.map((r) => {
        const total = parts.reduce((s, k) => s + (typeof r[k] === 'number' ? (r[k] as number) : 0), 0);
        return total > 0 ? { ...r, [target]: total } : r;
    });
}
