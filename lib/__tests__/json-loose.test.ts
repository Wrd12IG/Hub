import { describe, it, expect } from 'vitest';
import { parseJsonLoose, escapeControlCharsInStrings } from '../json-loose';

describe('parseJsonLoose', () => {
    it('legge JSON normale e avvolto in recinti', () => {
        expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
        expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    });

    it('sistema gli a capo veri dentro le stringhe (errore visto in produzione)', () => {
        const raw = '{"competitors":[{"name":"A","why":"prima riga\nseconda\triga"}]}';
        expect(() => JSON.parse(raw)).toThrow();
        expect(parseJsonLoose(raw).competitors[0].why).toBe('prima riga\nseconda\triga');
    });

    it('ignora il testo prima e dopo e prende l\'oggetto giusto', () => {
        const raw = 'Ho cercato sul web {non è json} ecco:\n{"competitors":[{"name":"A"}]}\nFonti: [1]';
        expect(parseJsonLoose(raw).competitors[0].name).toBe('A');
    });

    it('le graffe dentro le stringhe non rompono il bilanciamento', () => {
        expect(parseJsonLoose('testo {"a":"x } y","b":2} fine')).toEqual({ a: 'x } y', b: 2 });
    });

    it('non tocca gli a capo fuori dalle stringhe né le escape già scritte', () => {
        expect(escapeControlCharsInStrings('{\n"a": "x\\ny"\n}')).toBe('{\n"a": "x\\ny"\n}');
    });

    it('lancia quando non c\'è nessun oggetto', () => {
        expect(() => parseJsonLoose('niente da leggere')).toThrow('Risposta AI non leggibile');
    });
});
