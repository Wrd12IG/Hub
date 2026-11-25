/**
 * lib/dealer-kpi/overview.ts
 *
 * La vista d'insieme dei concessionari per un mese: una riga per cliente (lead, appuntamenti, preventivi, vendite e i passaggi
 * dell'imbuto), i totali di tutti e la ripartizione per marca e per provenienza. Pura: niente Firestore, niente rete.
 */
import { ENTRY_TYPES, TYPE_LABEL, type EntryType, type MonthTotals } from './types';
import { funnelRate } from './totals';

export interface OverviewInput { clientId: string; name: string; totals: MonthTotals | null }

export interface OverviewRow {
    clientId: string; name: string;
    /** false = lo Sheet non ha righe per questo mese: la riga resta, ma con «—» e non pesa nei totali. */
    hasData: boolean;
    byType: Record<EntryType, number>;
    appointmentRate: number | null; // appuntamenti su lead
    quoteRate: number | null;       // preventivi su appuntamenti
    saleRate: number | null;        // vendite su lead
}

export interface Breakdown { key: string; byType: Record<EntryType, number> }

export interface Overview {
    month: string;
    rows: OverviewRow[];
    totals: Record<EntryType, number>;
    rates: { appointmentRate: number | null; quoteRate: number | null; saleRate: number | null };
    byBrand: Breakdown[];
    bySource: Breakdown[];
    withData: number;
}

const zero = (): Record<EntryType, number> => ({ lead: 0, appuntamento: 0, preventivo: 0, vendita: 0 });
const ratesOf = (t: Record<EntryType, number>) => ({
    appointmentRate: funnelRate(t.appuntamento, t.lead),
    quoteRate: funnelRate(t.preventivo, t.appuntamento),
    saleRate: funnelRate(t.vendita, t.lead),
});

function addInto(map: Map<string, Record<EntryType, number>>, source: Record<EntryType, Record<string, number>>) {
    for (const type of ENTRY_TYPES) {
        for (const [key, n] of Object.entries(source[type] ?? {})) {
            const row = map.get(key) ?? zero();
            row[type] += n;
            map.set(key, row);
        }
    }
}

const toBreakdown = (map: Map<string, Record<EntryType, number>>): Breakdown[] =>
    Array.from(map, ([key, byType]) => ({ key, byType }))
        .sort((a, b) => b.byType.lead - a.byType.lead || b.byType.vendita - a.byType.vendita || a.key.localeCompare(b.key, 'it'));

export function buildOverview(month: string, inputs: OverviewInput[]): Overview {
    const totals = zero();
    const brands = new Map<string, Record<EntryType, number>>();
    const sources = new Map<string, Record<EntryType, number>>();
    const rows: OverviewRow[] = inputs.map((i) => {
        const t = i.totals && i.totals.month === month ? i.totals : null;
        const byType = t ? { ...zero(), ...t.byType } : zero();
        if (t) {
            for (const type of ENTRY_TYPES) totals[type] += byType[type];
            addInto(brands, t.byBrand);
            addInto(sources, t.bySource);
        }
        return { clientId: i.clientId, name: i.name, hasData: !!t, byType, ...ratesOf(byType) };
    });
    // Prima chi ha più lead; senza dati in fondo, in ordine alfabetico.
    rows.sort((a, b) => Number(b.hasData) - Number(a.hasData) || b.byType.lead - a.byType.lead || a.name.localeCompare(b.name, 'it'));
    return { month, rows, totals, rates: ratesOf(totals), byBrand: toBreakdown(brands), bySource: toBreakdown(sources), withData: rows.filter((r) => r.hasData).length };
}

/* ───────────── CSV (separatore «;»: Excel italiano) ───────────── */

type Cell = string | number | null;

const cell = (v: Cell): string => {
    if (v === null) return '';
    // Un testo che inizia con = + - @ verrebbe letto da Excel come formula: lo si neutralizza.
    // Fanno eccezione i numeri col segno («+5%», «-12,3»): sono variazioni, non formule.
    const isSignedNumber = typeof v === 'string' && /^[+-]\d[\d.,]*\s?%?$/.test(v);
    const s = typeof v === 'string' && !isSignedNumber && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const pct = (v: number | null): string => (v === null ? '' : String(v).replace('.', ','));
const line = (cells: Cell[]): string => cells.map(cell).join(';');

export function overviewToCsv(o: Overview): string {
    const out: string[] = [];
    out.push(line(['Mese', 'Cliente', ...ENTRY_TYPES.map((t) => TYPE_LABEL[t]), '% appuntamenti su lead', '% preventivi su appuntamenti', '% vendite su lead']));
    for (const r of o.rows) {
        out.push(line([
            o.month, r.name,
            ...ENTRY_TYPES.map((t): Cell => (r.hasData ? r.byType[t] : null)),
            r.hasData ? pct(r.appointmentRate) : '', r.hasData ? pct(r.quoteRate) : '', r.hasData ? pct(r.saleRate) : '',
        ]));
    }
    out.push(line([o.month, 'TOTALE', ...ENTRY_TYPES.map((t) => o.totals[t]), pct(o.rates.appointmentRate), pct(o.rates.quoteRate), pct(o.rates.saleRate)]));
    out.push('');
    const sections: Array<[string, Breakdown[]]> = [['Marca', o.byBrand], ['Provenienza', o.bySource]];
    for (const [title, list] of sections) {
        out.push(line([title, ...ENTRY_TYPES.map((t) => TYPE_LABEL[t])]));
        for (const b of list) out.push(line([b.key, ...ENTRY_TYPES.map((t) => b.byType[t])]));
        out.push('');
    }
    return '﻿' + out.join('\r\n');
}

/* ───────────── CSV di un solo concessionario ───────────── */

export interface ClientCsvKpi { group: string; label: string; value: number | null; unit: string; delta: string | null; note: string | null }

const numCell = (n: number | null): Cell => (n === null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));

/**
 * Il CSV della pagina di un concessionario: i totali di tutti i mesi con l'imbuto, la ripartizione per marca e provenienza del
 * mese scelto e, se già lette, le cifre di Analytics, Meta Ads e Google Ads dello stesso mese.
 */
export function clientToCsv(input: { name: string; months: MonthTotals[]; month: string | null; kpis?: ClientCsvKpi[] }): string {
    const out: string[] = [];
    out.push(line(['Cliente', input.name]));
    out.push('');
    out.push(line(['Mese', ...ENTRY_TYPES.map((t) => TYPE_LABEL[t]), '% appuntamenti su lead', '% preventivi su appuntamenti', '% vendite su lead']));
    for (const m of input.months) {
        const r = ratesOf({ ...zero(), ...m.byType });
        out.push(line([m.month, ...ENTRY_TYPES.map((t) => m.byType[t] ?? 0), pct(r.appointmentRate), pct(r.quoteRate), pct(r.saleRate)]));
    }
    const sel = input.months.find((m) => m.month === input.month);
    out.push('');
    if (sel) {
        const brands = new Map<string, Record<EntryType, number>>();
        const sources = new Map<string, Record<EntryType, number>>();
        addInto(brands, sel.byBrand);
        addInto(sources, sel.bySource);
        const sections: Array<[string, Breakdown[]]> = [['Marca (' + sel.month + ')', toBreakdown(brands)], ['Provenienza (' + sel.month + ')', toBreakdown(sources)]];
        for (const [title, list] of sections) {
            out.push(line([title, ...ENTRY_TYPES.map((t) => TYPE_LABEL[t])]));
            for (const b of list) out.push(line([b.key, ...ENTRY_TYPES.map((t) => b.byType[t])]));
            out.push('');
        }
    }
    if (input.kpis && input.kpis.length) {
        out.push(line(['KPI del mese' + (input.month ? ' (' + input.month + ')' : ''), 'KPI', 'Valore', 'Unità', 'Variazione sul mese prima', 'Nota']));
        for (const k of input.kpis) out.push(line([k.group, k.label, numCell(k.value), k.unit, k.delta ?? '', k.note ?? '']));
    }
    return '﻿' + out.join('\r\n');
}
