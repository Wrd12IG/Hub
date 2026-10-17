import { describe, it, expect } from 'vitest';
import { extractGaqlRows, totalsFromRows } from '../google-ads-composio';

const row = { metrics: { costMicros: '12500000', impressions: '1000', clicks: '50', conversions: 4 } };

describe('google-ads-composio', () => {
    it('estrae le righe da stringa JSON, batch, oggetto e array piatto', () => {
        expect(extractGaqlRows(JSON.stringify([{ results: [row] }]))).toHaveLength(1);
        expect(extractGaqlRows([{ results: [row, row] }, { results: [row] }])).toHaveLength(3);
        expect(extractGaqlRows({ results: [row] })).toHaveLength(1);
        expect(extractGaqlRows({ data: { results: [row] } })).toHaveLength(1);
        expect(extractGaqlRows([row, row])).toHaveLength(2);
        expect(extractGaqlRows('non json')).toEqual([]);
        expect(extractGaqlRows(null)).toEqual([]);
    });

    it('totali: stessa uscita di getGoogleAdsAccountTotals, anche con chiavi snake_case', () => {
        const t = totalsFromRows([row, { metrics: { cost_micros: 7500000, impressions: 1000, clicks: 50, conversions: 1 } }]);
        expect(t.cost).toBe(20);
        expect(t.impressions).toBe(2000);
        expect(t.clicks).toBe(100);
        expect(t.conversions).toBe(5);
        expect(t.ctr).toBeCloseTo(0.05);
        expect(t.cpc).toBe(0.2);
    });

    it('nessuna riga: zeri senza divisioni per zero', () => {
        expect(totalsFromRows([])).toEqual({ cost: 0, impressions: 0, clicks: 0, conversions: 0, ctr: 0, cpc: 0 });
    });
});
