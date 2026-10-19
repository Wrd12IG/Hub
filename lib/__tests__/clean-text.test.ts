import { describe, it, expect } from 'vitest';
import { stripCitations, trimToSentence } from '../clean-text';

describe('clean-text', () => {
    it('toglie i marcatori <cite> e tiene il testo', () => {
        const raw = "Tra le recensioni ricorre il tema. <cite index='2-3,2-4'>Una recensione lamenta che nessuno risponde .</cite> <cite index=\"4-2\">Su AutoScout24 la media è 4,0.</cite> Altro.";
        expect(stripCitations(raw)).toBe('Tra le recensioni ricorre il tema. Una recensione lamenta che nessuno risponde. Su AutoScout24 la media è 4,0. Altro.');
    });

    it('lascia stare il testo senza marcatori', () => {
        expect(stripCitations('Ciao  mondo, 5 < 6 e 7 > 3')).toBe('Ciao mondo, 5 < 6 e 7 > 3');
    });

    it('accorcia a fine frase, non a metà parola', () => {
        const t = 'Prima frase completa. Seconda frase completa. Terza frase che è molto più lunga e viene tagliata.';
        expect(trimToSentence(t, 50)).toBe('Prima frase completa. Seconda frase completa.');
        expect(trimToSentence('Breve.', 50)).toBe('Breve.');
    });

    it('senza fine frase utile si ferma a fine parola con i puntini', () => {
        expect(trimToSentence('parola '.repeat(20), 30)).toBe('parola parola parola parola…');
    });
});
