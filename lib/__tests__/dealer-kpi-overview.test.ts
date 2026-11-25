import { describe, it, expect } from 'vitest';
import { buildOverview, overviewToCsv } from '../dealer-kpi/overview';
import type { MonthTotals } from '../dealer-kpi/types';

const mk = (month: string, lead: number, app: number, prev: number, sale: number, brand = 'Renault', source = 'Meta'): MonthTotals => ({
    month,
    byType: { lead, appuntamento: app, preventivo: prev, vendita: sale },
    byBrand: { lead: { [brand]: lead }, appuntamento: { [brand]: app }, preventivo: { [brand]: prev }, vendita: { [brand]: sale } },
    bySource: { lead: { [source]: lead }, appuntamento: { [source]: app }, preventivo: { [source]: prev }, vendita: { [source]: sale } },
});

describe('buildOverview', () => {
    const o = buildOverview('2026-10', [
        { clientId: 'a', name: 'Alfa Auto', totals: mk('2026-10', 50, 20, 10, 5) },
        { clientId: 'b', name: 'Beta Motors', totals: mk('2026-10', 30, 9, 3, 1, 'Dacia', 'Google') },
        { clientId: 'c', name: 'Cento', totals: null },
        { clientId: 'd', name: 'Delta', totals: mk('2026-09', 99, 9, 9, 9) },
    ]);
    it('somma solo chi ha dati nel mese', () => {
        expect(o.totals).toEqual({ lead: 80, appuntamento: 29, preventivo: 13, vendita: 6 });
        expect(o.withData).toBe(2);
    });
    it("calcola l'imbuto per riga e in totale, senza dividere per zero", () => {
        expect(o.rows[0].appointmentRate).toBe(40);
        expect(o.rows[0].quoteRate).toBe(50);
        expect(o.rows[0].saleRate).toBe(10);
        const empty = o.rows.find((r) => r.clientId === 'c')!;
        expect(empty.hasData).toBe(false);
        expect(empty.appointmentRate).toBeNull();
        expect(o.rates.saleRate).toBe(7.5);
    });
    it('ordina per lead e mette in fondo chi non ha dati; un altro mese non conta', () => {
        expect(o.rows.map((r) => r.clientId)).toEqual(['a', 'b', 'c', 'd']);
        expect(o.rows[3].hasData).toBe(false);
    });
    it('ripartisce per marca e provenienza', () => {
        expect(o.byBrand.map((b) => [b.key, b.byType.lead])).toEqual([['Renault', 50], ['Dacia', 30]]);
        expect(o.bySource.map((b) => [b.key, b.byType.vendita])).toEqual([['Meta', 5], ['Google', 1]]);
    });
});

describe('overviewToCsv', () => {
    it('usa «;», virgola decimale, BOM e neutralizza le formule', () => {
        const o = buildOverview('2026-10', [{ clientId: 'x', name: '=CMD("x")', totals: mk('2026-10', 3, 1, 0, 0) }]);
        const csv = overviewToCsv(o);
        expect(csv.startsWith('﻿')).toBe(true);
        expect(csv).toContain('"\'=CMD(""x"")"');
        expect(csv).toContain('2026-10;');
        expect(csv).toContain('33,3');
        expect(csv).toContain('TOTALE');
        expect(csv).toContain('Marca;Lead;Appuntamento;Preventivo;Vendita');
    });
});
