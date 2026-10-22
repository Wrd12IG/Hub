import { describe, it, expect } from 'vitest';
import { timeOfPublication, combineDateAndTime } from '../publication-time';

describe('combineDateAndTime', () => {
    const day = new Date(2026, 9, 25); // 25 ottobre 2026, ora locale
    it('senza ora resta il solo giorno', () => expect(combineDateAndTime(day, '')).toBe('2026-10-25'));
    it('ora non valida: solo giorno', () => { expect(combineDateAndTime(day, '25:99')).toBe('2026-10-25'); expect(combineDateAndTime(day, 'ciao')).toBe('2026-10-25'); });
    it('con ora: istante che, letto di nuovo, torna la stessa ora', () => {
        const v = combineDateAndTime(day, '18:30');
        expect(v).toMatch(/T/);
        expect(timeOfPublication(v)).toBe('18:30');
        const d = new Date(v);
        expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 25]);
    });
});

describe('timeOfPublication', () => {
    it('solo giorno → vuoto', () => expect(timeOfPublication('2026-10-25')).toBe(''));
    it('vuoto o illeggibile → vuoto', () => { expect(timeOfPublication(undefined)).toBe(''); expect(timeOfPublication('Tboh')).toBe(''); });
});
