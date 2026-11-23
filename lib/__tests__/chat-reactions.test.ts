// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { isValidReaction, QUICK_REACTIONS, toggleReaction } from '@/lib/chat-reactions';

describe('reazioni della chat', () => {
    it('le reazioni rapide sono emoji vere, distinte e non vuote (erano stringhe vuote)', () => {
        expect(QUICK_REACTIONS.length).toBeGreaterThanOrEqual(5);
        for (const e of QUICK_REACTIONS) expect(isValidReaction(e)).toBe(true);
        expect(new Set(QUICK_REACTIONS).size).toBe(QUICK_REACTIONS.length);
    });
    it('rifiuta emoji vuote, solo spazi, troppo lunghe o non testo', () => {
        for (const bad of ['', '   ', 'x'.repeat(17), null, undefined, 5]) expect(isValidReaction(bad)).toBe(false);
    });
    it('aggiunge e toglie la reazione dello stesso utente', () => {
        const a = toggleReaction({}, '👍', 'u1');
        expect(a).toEqual({ '👍': ['u1'] });
        expect(toggleReaction(a, '👍', 'u1')).toEqual({});
    });
    it('più utenti sulla stessa emoji e altre emoji restano', () => {
        const r = toggleReaction({ '👍': ['u1'], '❤️': ['u2'] }, '👍', 'u3');
        expect(r).toEqual({ '👍': ['u1', 'u3'], '❤️': ['u2'] });
        expect(toggleReaction(r, '👍', 'u1')).toEqual({ '👍': ['u3'], '❤️': ['u2'] });
    });
    it('non modifica l\'oggetto di partenza', () => {
        const start = { '👍': ['u1'] };
        toggleReaction(start, '👍', 'u2');
        expect(start).toEqual({ '👍': ['u1'] });
    });
});
