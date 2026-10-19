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

import { metricRowsFromRows, metricRowsFromSeries, withSumColumn } from '../report-series';

describe('serie con più metriche', () => {
    it('somma le righe dello stesso giorno ma tiene l\'ultimo valore degli stati (follower)', () => {
        const rows = metricRowsFromRows([
            { date: '2026-10-02', page_impressions: 10, page_fans: 4656 },
            { date: '2026-10-02', page_impressions: 5, page_fans: 4657 },
            { date: '2026-10-01', page_impressions: 7, page_fans: 4650 },
            { date: 'boh', page_impressions: 99 },
        ], { impressions: { field: 'page_impressions' }, followers: { field: 'page_fans', mode: 'last' } });
        expect(rows).toEqual([
            { date: '2026-10-01', impressions: 7, followers: 4650 },
            { date: '2026-10-02', impressions: 15, followers: 4657 },
        ]);
    });

    it('i valori nulli o assenti non diventano zero', () => {
        expect(metricRowsFromRows([{ date: '2026-10-01', a: null, b: 3 }], { a: { field: 'a' }, b: { field: 'b' } })).toEqual([{ date: '2026-10-01', b: 3 }]);
    });

    it('le serie a pagamento prendono le chiavi della scheda (Meta: spend/leads, Google: cost/conversions)', () => {
        expect(metricRowsFromSeries('facebook', [{ date: '2026-10-01', spend: 12.345, results: 2, clicks: 30 }]))
            .toEqual([{ date: '2026-10-01', spend: 12.35, leads: 2, clicks: 30 }]);
        expect(metricRowsFromSeries('google_ads', [{ date: '2026-10-01', spend: 5, results: 1 }]))
            .toEqual([{ date: '2026-10-01', cost: 5, conversions: 1 }]);
    });

    it('somma più colonne in una (contatti GBP), senza creare la colonna se è tutto zero', () => {
        const rows = withSumColumn([{ date: 'a', call_clicks: 2, direction_requests: 3 }, { date: 'b', call_clicks: 0 }] as any, 'contacts', ['call_clicks', 'direction_requests', 'website_clicks']);
        expect(rows[0].contacts).toBe(5);
        expect(rows[1]).not.toHaveProperty('contacts');
    });
});
