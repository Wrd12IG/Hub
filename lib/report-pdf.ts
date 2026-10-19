// Contenuto del report PDF per il cliente: periodi proposti, formati dei numeri e tabelle per piattaforma. Pura: nessun
// accesso a rete o React (la pagina stampabile sta in app/report-pdf).

import type { PlatformReport } from './reporting';
import { PLATFORM_DEFS, COST_KEYS, type ReportSummary } from './report-metrics';
import { metricRowsFromSeries, type MetricRow } from './report-series';
import { formatEuro } from './format';
import { currentMonth } from './monthly-comment';

export type PdfPeriod = 'last30' | 'prevMonth' | 'thisMonth';

export const PDF_PERIODS: { id: PdfPeriod; label: string }[] = [
    { id: 'prevMonth', label: 'Mese scorso' },
    { id: 'thisMonth', label: 'Mese in corso' },
    { id: 'last30', label: 'Ultimi 30 giorni' },
];

const iso = (y: number, m0: number, d: number) => `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const todayIso = (now: Date) => iso(now.getFullYear(), now.getMonth(), now.getDate());

/** L'intervallo del periodo scelto e il mese cui riferire il commento dello staff (yyyy-MM). */
export function pdfRange(period: PdfPeriod, now = new Date()): { from: string; to: string; commentMonth: string } {
    const y = now.getFullYear(), m = now.getMonth();
    if (period === 'prevMonth') {
        const last = new Date(y, m, 0); // giorno 0 del mese corrente = ultimo giorno del precedente
        return { from: iso(last.getFullYear(), last.getMonth(), 1), to: iso(last.getFullYear(), last.getMonth(), last.getDate()), commentMonth: currentMonth(last) };
    }
    if (period === 'thisMonth') return { from: iso(y, m, 1), to: todayIso(now), commentMonth: currentMonth(now) };
    const start = new Date(y, m, now.getDate() - 29);
    return { from: iso(start.getFullYear(), start.getMonth(), start.getDate()), to: todayIso(now), commentMonth: currentMonth(now) };
}

const MONEY = new Set(['spend', 'cost', 'cpc_calc', 'cpm_calc', 'cost_per_lead', 'sale_amount', 'purchase_revenue', 'conversion_value', 'flow_value', 'campaign_value', 'total_cost', 'pending_sale_amount', 'average_order_value']);
const PERCENT = new Set(['ctr_pct', 'lead_rate_pct', 'open_rate', 'unsubscribe_rate']);
const NEUTRAL = new Set(['spend', 'cost', 'total_cost']);
const DECIMAL = new Set(['position', 'roas', 'review_average_rating_total']);

const it1 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: 'always' });
const it0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' });

export function formatMetric(key: string, value: number): string {
    if (MONEY.has(key)) return formatEuro(value);
    if (PERCENT.has(key)) return `${it1.format(value)}%`;
    if (DECIMAL.has(key)) return it1.format(value);
    return it0.format(value);
}

export interface PdfRow { label: string; value: string; previous: string | null; deltaPct: number | null; good: boolean | null }
export interface PdfChart { label: string; euro: boolean; points: { date: string; value: number }[] }
export interface PdfSection { id: string; title: string; rows: PdfRow[]; chart: PdfChart | null }

/** Una sezione per piattaforma collegata e con dati; GBP una per sede. Le metriche senza valore nel periodo non compaiono. */
export function buildPdfSections(platforms: PlatformReport[]): PdfSection[] {
    return platforms.flatMap((p, i): PdfSection[] => {
        const def = PLATFORM_DEFS[p.platform];
        const cur = p.rows?.[0];
        if (!def || !p.connected || !cur) return [];
        const prev = p.previousRows?.[0];
        const rows = def.metrics.flatMap((m): PdfRow[] => {
            const v = cur[m.key];
            if (typeof v !== 'number' || !Number.isFinite(v)) return [];
            const pv = prev?.[m.key];
            const hasPrev = typeof pv === 'number' && Number.isFinite(pv);
            const deltaPct = hasPrev && pv !== 0 ? Math.round(((v - pv) / pv) * 1000) / 10 : null;
            return [{
                label: m.label.replace(/\s*€$/, '').replace(/\s*%$/, ''),
                value: formatMetric(m.key, v),
                previous: hasPrev ? formatMetric(m.key, pv as number) : null,
                deltaPct,
                // La spesa è un investimento, non una prestazione: né bene né male (a un cliente, un +6% rosso sembra un allarme)
                good: deltaPct === null || deltaPct === 0 || NEUTRAL.has(m.key) ? null : COST_KEYS.has(m.key) ? deltaPct < 0 : deltaPct > 0,
            }];
        });
        if (rows.length === 0 || rows.every((r) => r.value === '0' || r.value === '€0,00')) return [];
        return [{ id: `${p.platform}-${i}`, title: def.label + (p.accountLabel && p.platform === 'gbp' ? ` · ${p.accountLabel}` : ''), rows, chart: pickChart(p) }];
    });
}

/**
 * Il grafico piccolo di una piattaforma: la prima metrica del suo elenco «grafico» che ha davvero dati nel periodo
 * (Meta e Google Ads: spesa, poi risultato). Meno di 3 giorni di dati non fanno un grafico: null.
 */
export function pickChart(p: PlatformReport): PdfChart | null {
    const def = PLATFORM_DEFS[p.platform];
    if (!def?.chart?.length) return null;
    const rows: MetricRow[] = p.daily ?? (p.series && (p.platform === 'facebook' || p.platform === 'google_ads') ? metricRowsFromSeries(p.platform, p.series) : []);
    if (rows.length < 3) return null;
    for (const m of def.chart) {
        const points = rows
            .map((r) => ({ date: String(r.date), value: typeof r[m.key] === 'number' ? (r[m.key] as number) : NaN }))
            .filter((x) => Number.isFinite(x.value))
            .sort((a, b) => a.date.localeCompare(b.date));
        if (points.length >= 3 && points.some((x) => x.value > 0)) return { label: m.label, euro: m.unit === 'euro', points };
    }
    return null;
}

const pctText = (cur: number, prev: number | null) => {
    if (prev === null || prev === 0) return '';
    const d = Math.round(((cur - prev) / prev) * 1000) / 10;
    if (d === 0) return ' (invariato rispetto al periodo precedente)';
    return ` (${d > 0 ? '+' : '−'}${Math.abs(d).toLocaleString('it-IT')}% rispetto al periodo precedente)`;
};

/** Le frasi dell'«In sintesi»: cosa è successo, in parole, dai numeri già calcolati. Niente frasi senza dati. */
export function buildHighlights(sum: ReportSummary): string[] {
    const out: string[] = [];
    if (sum.result) {
        out.push(`${it0.format(sum.result.value)} ${sum.result.label} nel periodo${pctText(sum.result.value, sum.result.previous)}${sum.result.source ? `, da ${sum.result.source.split(' — ')[0]}` : ''}.`);
    }
    if (sum.spend) out.push(`Investimento pubblicitario (Meta e Google Ads): ${formatEuro(sum.spend.value)}${pctText(sum.spend.value, sum.spend.previous)}.`);
    if (sum.result && sum.costPerResult !== null) out.push(`Costo medio di ogni risultato (${sum.result.label}): ${formatEuro(sum.costPerResult)}.`);
    const good = sum.alerts.filter((a) => a.good).sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
    const bad = sum.alerts.filter((a) => !a.good).sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
    const fmt = (a: ReportSummary['alerts'][number]) => `${a.label} su ${a.platform} ${a.value > 0 ? '+' : '−'}${Math.abs(a.value).toLocaleString('it-IT')}%`;
    if (good) out.push(`In crescita: ${fmt(good)}.`);
    if (bad) out.push(`Da tenere d'occhio: ${fmt(bad)}.`);
    return out;
}
