import { describe, it, expect } from 'vitest';
import { normalizeTags, composePostText } from '../post-text';

describe('normalizeTags', () => {
    it('aggiunge il simbolo e toglie i doppioni', () => expect(normalizeTags('estate  offerta,#Auto Estate', '#')).toEqual(['#estate', '#offerta', '#Auto']));
    it('menzioni con @ e punti ammessi', () => expect(normalizeTags('@toyota_italia wr.digital', '@')).toEqual(['@toyota_italia', '@wr.digital']));
    it('toglie i simboli spuri e i vuoti', () => expect(normalizeTags('## !!! #ok#', '#')).toEqual(['#ok']));
    it('vuoto', () => expect(normalizeTags(undefined, '#')).toEqual([]));
    it('lettere accentate', () => expect(normalizeTags('città', '#')).toEqual(['#città']));
});

describe('composePostText', () => {
    it('didascalia, menzioni, hashtag', () => expect(composePostText('Ciao', 'estate', 'toyota', 2200)).toBe('Ciao\n\n@toyota\n#estate'));
    it('non ripete quelli già nel testo', () => expect(composePostText('Ciao #estate', 'estate auto', '', 2200)).toBe('Ciao #estate\n\n#auto'));
    it('senza coda restituisce la didascalia', () => expect(composePostText('Solo testo', '', '', 2200)).toBe('Solo testo'));
    it('se manca spazio accorcia la didascalia e tiene i tag', () => {
        const r = composePostText('a'.repeat(100), 'tag', 'me', 40);
        expect(r.length).toBeLessThanOrEqual(40);
        expect(r.endsWith('@me\n#tag')).toBe(true);
    });
    it('solo coda quando la didascalia è vuota', () => expect(composePostText('', 'x', '', 100)).toBe('#x'));
});
