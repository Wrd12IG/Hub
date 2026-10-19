import { describe, it, expect } from 'vitest';
import { ratio, metaDerived, withMetaDerived } from '../meta-metrics';

describe('meta-metrics', () => {
    it('ratio restituisce undefined con divisore zero', () => {
        expect(ratio(5, 0)).toBeUndefined();
        expect(ratio(1, 4, 100)).toBe(25);
    });

    it('calcola le derivate dai totali (City Motors 30gg: 403 spesa, 51 lead)', () => {
        const d = metaDerived({ spend: 402.97, impressions: 65745, clicks: 1303, leads: 51 });
        expect(d.costPerLead).toBe(7.9);
        expect(d.ctrPct).toBe(1.98);
        expect(d.cpc).toBe(0.31);
        expect(d.cpm).toBe(6.13);
        expect(d.leadRatePct).toBe(3.91);
    });

    it('senza lead il costo per lead non esiste (non è 0)', () => {
        const r = withMetaDerived({ spend: 100, impressions: 1000, clicks: 10 });
        expect(r.cost_per_lead).toBeUndefined();
        expect(r.leads).toBeUndefined();
        expect(r.ctr_pct).toBe(1);
    });
});
