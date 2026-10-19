import { describe, it, expect } from 'vitest';
import { summarizeCampaigns, rowMetrics } from '../campaign-metrics';

describe('campaign-metrics', () => {
    it('ricalcola le medie dai totali, non le media', () => {
        const s = summarizeCampaigns([
            { spend: 300, impressions: 40000, clicks: 800, conversions: 40 },
            { spend: 10, impressions: 100, clicks: 50, conversions: 0 },
        ]);
        expect(s.spend).toBe(310);
        expect(s.costPerConversion).toBe(7.75);
        expect(s.ctr).toBe(2.11);
    });

    it('senza conversioni il costo per conversione non esiste', () => {
        expect(rowMetrics({ spend: 9.99, impressions: 5000, clicks: 94, conversions: 0 }).costPerConversion).toBeUndefined();
    });

    it('elenco vuoto: tutto a zero e nessuna percentuale', () => {
        const s = summarizeCampaigns([]);
        expect(s.spend).toBe(0);
        expect(s.ctr).toBeUndefined();
    });
});
