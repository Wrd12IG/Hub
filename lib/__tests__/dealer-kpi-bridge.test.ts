// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeManualWithSheet, sheetToManual, typesPresent } from '@/lib/dealer-kpi/bridge';
import { totalsByMonth } from '@/lib/dealer-kpi/totals';
import { parseDealerSheet } from '@/lib/dealer-kpi/parse';

const store: Record<string, Record<string, unknown>> = {};
vi.mock('@/lib/firebase-admin', () => ({
    adminDb: {
        collection: (c: string) => ({ doc: (id: string) => ({ collection: (sub: string) => ({ doc: (m: string) => ({ path: `${c}/${id}/${sub}/${m}` }) }) }) }),
        getAll: async (...refs: Array<{ path: string }>) => refs.map((r) => ({ exists: !!store[r.path], data: () => store[r.path] })),
    },
}));

const H = ['Mese', 'Tipo', 'Marca', 'Provenienza', 'Quantità'];
const month = (rows: string[][]) => {
    const parsed = parseDealerSheet([H, ...rows]);
    const t = totalsByMonth(parsed.entries)[0];
    return { totals: t, entries: parsed.entries };
};

describe('ponte Sheet → dati reali', () => {
    it('lead, appuntamenti e vendite diventano i campi dei dati reali; i preventivi no (non hanno un campo)', () => {
        const { totals, entries } = month([['2026-11', 'Lead', 'Fiat', 'Google', '10'], ['2026-11', 'Appuntamento', 'Fiat', 'Google', '4'], ['2026-11', 'Preventivo', 'Fiat', 'Google', '3'], ['2026-11', 'Vendita', 'Fiat', 'Google', '1']]);
        expect(sheetToManual(totals, typesPresent(entries))).toEqual({ leads_real: 10, appointments: 4, sales: 1 });
    });
    it('un tipo che nello Sheet non c\'è resta «dato mancante»: non diventa zero', () => {
        const { totals, entries } = month([['2026-11', 'Lead', 'Fiat', 'Google', '10']]);
        expect(sheetToManual(totals, typesPresent(entries))).toEqual({ leads_real: 10 });
    });
    it('uno zero scritto nello Sheet è uno zero vero', () => {
        const { totals, entries } = month([['2026-11', 'Vendita', 'Fiat', 'Showroom', '0']]);
        expect(sheetToManual(totals, typesPresent(entries))).toEqual({ sales: 0 });
    });
    it('il valore scritto a mano ha la precedenza; gli altri vengono dallo Sheet', () => {
        const m = mergeManualWithSheet({ leads_real: 12, test_drives: 5 }, { leads_real: 10, appointments: 4 });
        expect(m.values).toEqual({ leads_real: 12, appointments: 4, test_drives: 5 });
        expect(m.fromSheet).toEqual({ appointments: true });
    });
    it('senza dati a mano tutto arriva dallo Sheet; senza Sheet resta come prima', () => {
        expect(mergeManualWithSheet(undefined, { sales: 2 })).toEqual({ values: { sales: 2 }, fromSheet: { sales: true } });
        expect(mergeManualWithSheet({ sales: 3 }, undefined)).toEqual({ values: { sales: 3 }, fromSheet: {} });
    });
});

describe('lettura dei dati reali con lo Sheet (readManualKpis)', () => {
    beforeEach(() => { for (const k of Object.keys(store)) delete store[k]; });
    const dealerDoc = (rows: string[][]) => { const { totals, entries } = month(rows); return { month: '2026-11', totals, entries }; };

    it('unisce dati a mano e Sheet, e dice cosa viene dallo Sheet', async () => {
        store['clients/c1/manual_kpis/2026-11'] = { leads_real: 12 };
        store['clients/c1/dealerKpi/2026-11'] = dealerDoc([['2026-11', 'Lead', 'Fiat', 'Google', '10'], ['2026-11', 'Vendita', 'Fiat', 'Showroom', '2']]);
        const { readManualKpisDetailed, readManualKpis } = await import('@/lib/monthly-mail-store');
        const d = await readManualKpisDetailed(['c1'], '2026-11');
        expect(d.c1.values).toEqual({ leads_real: 12, sales: 2 });
        expect(d.c1.fromSheet).toEqual({ sales: true });
        // la mail mensile usa la stessa lettura
        expect(await readManualKpis(['c1'], '2026-11')).toEqual({ c1: { leads_real: 12, sales: 2 } });
    });
    it('un cliente solo con lo Sheet compare; uno senza niente no; un mese diverso non si mischia', async () => {
        store['clients/c2/dealerKpi/2026-11'] = dealerDoc([['2026-11', 'Lead', 'Fiat', 'Meta', '7']]);
        const { readManualKpisDetailed } = await import('@/lib/monthly-mail-store');
        const nov = await readManualKpisDetailed(['c2', 'c3'], '2026-11');
        expect(Object.keys(nov)).toEqual(['c2']);
        expect(nov.c2.values).toEqual({ leads_real: 7 });
        expect(await readManualKpisDetailed(['c2'], '2026-10')).toEqual({});
    });
});
