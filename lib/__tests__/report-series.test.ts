import { describe, it, expect } from 'vitest';
import { dailyFromRows, buildTrend } from '../report-series';

describe('report-series', () => {
    it('righe di Windsor → serie ordinata, più righe dello stesso giorno si sommano', () => {
        const s = dailyFromRows([
            { date: '2026-10-02', spend: 10, actions_lead: 1 },
            { date: '2026-10-01', spend: 5, actions_lead: 0 },
            { date: '2026-10-02', spend: 2.5, actions_lead: 2 },
            { date: 'boh', spend: 99 },
        ], { spend: 'spend', results: 'actions_lead' });
        expect(s).toEqual([{ date: '2026-10-01', spend: 5, results: 0 }, { date: '2026-10-02', spend: 12.5, results: 3 }]);
    });

    it('riempie i giorni mancanti con zero e calcola il costo per risultato', () => {
        const t = buildTrend([{ date: '2026-10-01', spend: 20, results: 2 }, { date: '2026-10-03', spend: 30, results: 0 }]);
        expect(t.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
        expect(t[0]).toMatchObject({ spend: 20, results: 2, costPerResult: 10 });
        expect(t[1]).toMatchObject({ spend: 0, results: 0, costPerResult: null });
        expect(t[2].costPerResult).toBeNull();
    });

    it('costo su 7 giorni mobili: spesa dei giorni / risultati dei giorni', () => {
        const t = buildTrend([{ date: '2026-10-01', spend: 20, results: 2 }, { date: '2026-10-02', spend: 40, results: 0 }, { date: '2026-10-03', spend: 30, results: 3 }]);
        expect(t[2].costPerResult7d).toBe(18); // (20+40+30) / (2+0+3)
        expect(t[1].costPerResult7d).toBe(30); // (20+40) / 2
    });

    it('la spesa degli altri canali conta nella spesa del giorno ma non nel costo per risultato', () => {
        const t = buildTrend([{ date: '2026-10-01', spend: 20, results: 2 }], [{ date: '2026-10-01', spend: 100 }]);
        expect(t[0]).toMatchObject({ spend: 120, costPerResult: 10 });
    });

    it('senza risultati (es. l\'esito viene da GBP) restano solo spesa e date', () => {
        const t = buildTrend([], [{ date: '2026-10-01', spend: 50 }], false);
        expect(t).toEqual([{ date: '2026-10-01', spend: 50, results: null, costPerResult: null, costPerResult7d: null }]);
    });

    it('nessun dato: nessun punto', () => {
        expect(buildTrend([])).toEqual([]);
    });
});
