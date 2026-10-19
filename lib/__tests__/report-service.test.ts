import { describe, it, expect } from 'vitest';
import { reportCacheKey, ttlFor, forFirestore, DEFAULT_VIEW, TTL_OK_MS, TTL_DEGRADED_MS } from '../report-service';

describe('report-service', () => {
    it('la chiave di cache distingue periodo e confronto e non contiene caratteri strani', () => {
        expect(reportCacheKey('last_30d', '30', 'prev_period')).toBe('report4_last_30d_30_prev_period');
        expect(reportCacheKey('last_7d', '7', 'none')).not.toBe(reportCacheKey('last_30d', '30', 'none'));
        expect(reportCacheKey('a/b', '3 0', 'none')).toBe('report4_ab_30_none');
    });

    it('la vista che il giro notturno prepara è quella che la pagina chiede all\'apertura', () => {
        expect(reportCacheKey(DEFAULT_VIEW.datePreset, DEFAULT_VIEW.days, DEFAULT_VIEW.compare)).toBe('report4_last_30d_30_prev_period');
    });

    it('un report con una fonte in errore o vuoto dura poco, altrimenti sei ore', () => {
        const ok = { platform: 'facebook', connected: true, rows: [], previousRows: [] } as any;
        expect(ttlFor([ok])).toBe(TTL_OK_MS);
        expect(ttlFor([ok, { ...ok, connected: false }])).toBe(TTL_DEGRADED_MS);
        expect(ttlFor([])).toBe(TTL_DEGRADED_MS);
    });

    it('forFirestore toglie gli undefined (Firestore li rifiuta)', () => {
        expect(forFirestore({ a: 1, b: undefined, c: [{ d: undefined, e: 2 }] })).toEqual({ a: 1, c: [{ e: 2 }] });
    });
});
