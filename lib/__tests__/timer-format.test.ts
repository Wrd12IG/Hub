import { describe, it, expect } from 'vitest';
import { formatElapsed } from '../timer-format';

describe('formatElapsed', () => {
    it('formatta ore, minuti e secondi', () => {
        expect(formatElapsed(0)).toBe('00:00:00');
        expect(formatElapsed(61)).toBe('00:01:01');
        expect(formatElapsed(3725)).toBe('01:02:05');
    });
    it('ignora valori negativi e decimali', () => {
        expect(formatElapsed(-5)).toBe('00:00:00');
        expect(formatElapsed(59.9)).toBe('00:00:59');
    });
});
