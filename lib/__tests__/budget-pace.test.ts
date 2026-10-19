import { describe, it, expect } from 'vitest';
import { computeBudgetPace } from '../budget-pace';

const base = { spend: 400, result: 50, resultLabel: 'lead', costPerResult: 8, periodDays: 30 };

describe('budget e obiettivo', () => {
    it('senza budget né obiettivo non propone niente', () => {
        expect(computeBudgetPace(base)).toMatchObject({ budget: null, goal: null, proposals: [] });
    });

    it('spesa in linea con il budget', () => {
        const p = computeBudgetPace({ ...base, budget: 400 });
        expect(p.budget).toMatchObject({ usedPct: 100, status: 'in-linea', tone: 'good' });
    });

    it('proietta su 30 giorni un periodo di 15', () => {
        const p = computeBudgetPace({ ...base, periodDays: 15, budget: 800 });
        expect(p.budget?.projected).toBe(800);
        expect(p.budget?.planned).toBe(400);
    });

    it('sfora il budget: propone di ridurre', () => {
        const p = computeBudgetPace({ ...base, budget: 300 });
        expect(p.budget?.status).toBe('sopra');
        expect(p.proposals[0].tone).toBe('bad');
    });

    it('obiettivo mancato con budget che avanza: basta aumentare la spesa', () => {
        const p = computeBudgetPace({ ...base, budget: 1000, target: 100 });
        expect(p.goal?.reachedPct).toBe(50);
        const t = p.proposals.map((x) => x.text).join(' ');
        expect(t).toContain('€400 in più');
        expect(t).toContain('Il budget lo consente');
    });

    it('obiettivo mancato con budget insufficiente: propone di alzarlo', () => {
        const p = computeBudgetPace({ ...base, budget: 450, target: 100 });
        expect(p.proposals.at(-1)?.tone).toBe('bad');
        expect(p.proposals.at(-1)?.text).toContain('€800');
    });

    it('obiettivo raggiunto', () => {
        const p = computeBudgetPace({ ...base, target: 40 });
        expect(p.goal?.tone).toBe('good');
    });

    it('periodo troppo corto: nessun consiglio, solo avviso', () => {
        const p = computeBudgetPace({ ...base, periodDays: 3, budget: 400, target: 50 });
        expect(p.shortPeriod).toBe(true);
        expect(p.proposals).toHaveLength(1);
    });

    it('senza costo per risultato non stima la spesa necessaria', () => {
        const p = computeBudgetPace({ ...base, costPerResult: null, target: 100 });
        expect(p.proposals[0].text).toContain('non è calcolabile');
    });
});
