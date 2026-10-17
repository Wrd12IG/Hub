import { describe, it, expect } from 'vitest';
import { formatEuro } from '../format';

describe('formatEuro', () => {
    it('raggruppa anche i numeri a 4 cifre e usa la virgola', () => {
        expect(formatEuro(8271.76)).toBe('€8.271,76');
        expect(formatEuro(12844.31)).toBe('€12.844,31');
        expect(formatEuro(0)).toBe('€0,00');
        expect(formatEuro(1234.5, 0)).toBe('€1.235');
    });
});

import { getInitials } from '../utils';
describe('getInitials', () => {
    it('non produce "undefined" con spazi finali o doppi', () => {
        expect(getInitials('FURECO ')).toBe('F');
        expect(getInitials('Anna  Rossi')).toBe('AR');
        expect(getInitials('   ')).toBe('?');
    });
});
