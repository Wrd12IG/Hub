import { describe, it, expect } from 'vitest';
import { pickFrameTime } from '../video-frame';

describe('pickFrameTime', () => {
    it('video normale: mezzo secondo', () => expect(pickFrameTime(30)).toBe(0.5));
    it('video brevissimo: un decimo della durata', () => expect(pickFrameTime(2)).toBeCloseTo(0.2));
    it('durata non valida: zero', () => {
        expect(pickFrameTime(NaN)).toBe(0);
        expect(pickFrameTime(Infinity)).toBe(0);
        expect(pickFrameTime(0)).toBe(0);
    });
});
