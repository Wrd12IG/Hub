/**
 * lib/dealer-kpi/totals.ts
 *
 * Dai dati normalizzati ai totali per mese: per tipo, e per tipo con il dettaglio per marca e per provenienza. Pura.
 */
import { ENTRY_TYPES, type DealerEntry, type EntryType, type MonthTotals } from './types';

const emptyByType = (): Record<EntryType, number> => ({ lead: 0, appuntamento: 0, preventivo: 0, vendita: 0 });
const emptyMaps = (): Record<EntryType, Record<string, number>> => ({ lead: {}, appuntamento: {}, preventivo: {}, vendita: {} });

export function totalsByMonth(entries: DealerEntry[]): MonthTotals[] {
    const months = new Map<string, MonthTotals>();
    for (const e of entries) {
        const m = months.get(e.month) ?? { month: e.month, byType: emptyByType(), byBrand: emptyMaps(), bySource: emptyMaps() };
        m.byType[e.type] += e.count;
        m.byBrand[e.type][e.brand] = (m.byBrand[e.type][e.brand] || 0) + e.count;
        m.bySource[e.type][e.source] = (m.bySource[e.type][e.source] || 0) + e.count;
        months.set(e.month, m);
    }
    return Array.from(months.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/** Percentuale tra due passaggi dell'imbuto (es. appuntamenti su lead). null se il denominatore è 0: non si inventa un valore. */
export function funnelRate(numerator: number, denominator: number): number | null {
    return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : null;
}

export { ENTRY_TYPES };
