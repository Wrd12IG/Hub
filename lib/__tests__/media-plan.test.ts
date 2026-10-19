import { describe, it, expect } from 'vitest';
import { computePlan, parsePlanRows, DEFAULT_ASSUMPTIONS, emptyPlan, type PlanLine } from '../media-plan';

const L = (month: string, channel: PlanLine['channel'], kind: string, amount: number): PlanLine => ({ id: `${month}${kind}${amount}`, month, channel, kind, description: '', amount });

// Il piano Q4 2026 City Motors (12.000 €): Meta 5.550, Google 3.200, Off line 3.250
const Q4: PlanLine[] = [
    L('2026-10', 'Off line', 'Affissioni', 1500), L('2026-10', 'Off line', 'Advertorial', 400), L('2026-10', 'Meta', 'Warm-up', 1500),
    L('2026-10', 'Google', 'Search', 80), L('2026-10', 'Google', 'YT-DG', 650),
    L('2026-11', 'Off line', 'Esposizione', 850), L('2026-11', 'Meta', 'Warm-up', 750), L('2026-11', 'Meta', 'Lead', 1300),
    L('2026-11', 'Google', 'Search', 85), L('2026-11', 'Google', 'YT-DG', 550), L('2026-11', 'Google', 'Remarketing', 500),
    L('2026-12', 'Off line', 'Giornale', 500), L('2026-12', 'Meta', 'Lead', 1450), L('2026-12', 'Meta', 'Closing', 550),
    L('2026-12', 'Google', 'Search', 85), L('2026-12', 'Google', 'YT-DG', 450), L('2026-12', 'Google', 'Remarketing', 800),
];

describe('piano media', () => {
    const s = computePlan({ lines: Q4, assumptions: DEFAULT_ASSUMPTIONS });

    it('riepilogo per canale e mese come nel foglio', () => {
        expect(s.months).toEqual(['2026-10', '2026-11', '2026-12']);
        expect(s.channelTotals).toEqual({ Meta: 5550, Google: 3200, 'Off line': 3250 });
        expect(s.total).toBe(12000);
        expect(s.monthTotals['2026-10']).toBe(4130);
        expect(Math.round(s.adsShare * 1000) / 10).toBe(72.9);
    });

    it('lead Meta: budget / costo per lead di ogni fase', () => {
        // 1300/9,5 + 1450/9,5 + 550/12
        expect(s.base.meta).toBeCloseTo(1300 / 9.5 + 1450 / 9.5 + 550 / 12, 6);
    });

    it('lead Google: Search e Remarketing, non YouTube/Demand Gen', () => {
        const g = DEFAULT_ASSUMPTIONS.google;
        expect(s.base.google).toBeCloseTo((250 / g.cpcSearch) * g.cvrSearch + (1300 / g.cpcRemarketing) * g.cvrRemarketing, 6);
        expect(s.searchClicks).toBeCloseTo(250 / g.cpcSearch, 6);
    });

    it('scenario prudente = base x fattore; costo per lead cresce', () => {
        expect(s.prudent.leads).toBeCloseTo(s.base.leads * 0.6, 6);
        expect(s.prudent.cplGross).toBeGreaterThan(s.base.cplGross);
        expect(s.base.cplGross).toBeCloseTo(s.ads / s.base.leads, 6);
        expect(s.base.cplAllBudget).toBeGreaterThan(s.base.cplQualified);
    });

    it('reach del warm-up: impression / frequenza', () => {
        expect(s.metaWarmupReach).toBeCloseTo((2250 / 4.25 * 1000) / 3, 4);
    });

    it('piano vuoto: tutto a zero, nessuna divisione per zero', () => {
        const e = computePlan(emptyPlan());
        expect(e.total).toBe(0);
        expect(e.base.cplGross).toBe(0);
    });

    it('ignora righe senza importo o con mese non valido', () => {
        const x = computePlan({ lines: [L('2026-10', 'Meta', 'Lead', 0), L('ottobre', 'Meta', 'Lead', 100)], assumptions: DEFAULT_ASSUMPTIONS });
        expect(x.total).toBe(0);
    });
});

describe('import del foglio Piano Media', () => {
    const rows: unknown[][] = [
        ['SALES LOCAL MARKETING'], [],
        ['DISTRETTO', 'DATA', 'Codice', 'DEALER', 'CARLINE', 'MEZZI', 'INVESTIMENTO', 'Canale', 'Linea'],
        [undefined, 'Ottobre', '000173', 'X', 'HILUX', 'Affissioni grande formato', 1500, 'Off line', 'Affissioni'],
        [undefined, 'Novembre', '000173', 'X', 'PROACE', 'META - lead form', 1300, 'Meta', 'Lead'],
        [undefined, 'Dicembre', '000173', 'X', 'PROACE', 'riga rotta', 'n/d', 'Meta', 'Lead'],
        [undefined, undefined, undefined, undefined, undefined, 'TOTALE', 2800],
    ];
    it('legge righe valide e conta quelle scartate', () => {
        const r = parsePlanRows(rows, 2026);
        expect(r.lines).toHaveLength(2);
        expect(r.lines[0]).toMatchObject({ month: '2026-10', channel: 'Off line', kind: 'Affissioni', amount: 1500 });
        expect(r.lines[1]).toMatchObject({ month: '2026-11', channel: 'Meta', kind: 'Lead', description: 'META - lead form' });
        expect(r.skipped).toBe(2);
    });
    it('senza intestazioni riconoscibili non importa niente', () => {
        expect(parsePlanRows([['a', 'b']], 2026).lines).toEqual([]);
    });
});
