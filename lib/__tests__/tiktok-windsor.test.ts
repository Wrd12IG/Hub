import { describe, it, expect } from 'vitest';
import { followerSeries } from '../tiktok-windsor';

describe('followerSeries', () => {
    it('scarta i giorni a 0 (dato non pronto) invece di contarli come crollo', () => {
        const rows = [
            { date: '2026-11-05', total_followers_count: 228 },
            { date: '2026-11-06', total_followers_count: 229 },
            { date: '2026-11-08', total_followers_count: 0 },
            { date: '2026-11-09', total_followers_count: 228 },
        ];
        const s = followerSeries(rows);
        expect(s.followers).toBe(228);
        expect(s.followerDelta.get('2026-11-06')).toEqual({ acquisito: 1, perso: 0 });
        expect(s.followerDelta.get('2026-11-09')).toEqual({ acquisito: 0, perso: 1 });
        expect(s.followerDelta.has('2026-11-08')).toBe(false);
    });

    it('senza righe valide restituisce 0 follower e nessuna variazione', () => {
        const s = followerSeries([{ date: '2026-11-08', total_followers_count: 0 }]);
        expect(s.followers).toBe(0);
        expect(s.followerDelta.size).toBe(0);
    });
});
