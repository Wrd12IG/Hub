import { describe, it, expect } from 'vitest';
import { decodeEntities } from '../html-entities';

describe('decodeEntities', () => {
    it('decodifica numeriche decimali ed esadecimali', () => {
        expect(decodeEntities('SCOPRI L&#039;OFFERTA')).toBe("SCOPRI L'OFFERTA");
        expect(decodeEntities('a &#x20AC; b')).toBe('a € b');
    });
    it('decodifica le nominate e lascia stare le sconosciute', () => {
        expect(decodeEntities('Rossi &amp; Figli &egrave; qui &foo;')).toBe('Rossi & Figli è qui &foo;');
    });
    it('un codice impossibile resta com\'è', () => {
        expect(decodeEntities('&#99999999;')).toBe('&#99999999;');
    });
});
