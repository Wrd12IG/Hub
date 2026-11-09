import { describe, it, expect } from 'vitest';
import { daysBetween } from '../facebook-windsor';

describe('daysBetween', () => {
    it('include entrambi gli estremi', () => {
        expect(daysBetween('2026-11-07', '2026-11-09')).toEqual(['2026-11-07', '2026-11-08', '2026-11-09']);
    });
    it('date non valide danno un elenco vuoto', () => {
        expect(daysBetween('boh', '2026-11-09')).toEqual([]);
    });
    it('a cavallo di fine mese', () => {
        expect(daysBetween('2026-10-30', '2026-11-02')).toHaveLength(4);
    });
});
