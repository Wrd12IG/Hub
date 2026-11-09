import { describe, it, expect } from 'vitest';
import { metricRowsFromRows } from '../report-series';

describe('metricRowsFromRows skipZero', () => {
    const map = { followers: { field: 'total_followers_count', mode: 'last' as const, skipZero: true }, likes: { field: 'likes' } };

    it('lascia senza punto il giorno con follower a 0 (dato non pronto) ma tiene gli altri valori', () => {
        const rows = [
            { date: '2026-11-07', total_followers_count: 228, likes: 2 },
            { date: '2026-11-08', total_followers_count: 0, likes: 0 },
        ];
        const out = metricRowsFromRows(rows, map);
        expect(out[0].followers).toBe(228);
        expect(out[1].followers).toBeUndefined();
        expect(out[1].likes).toBe(0);
    });
});
