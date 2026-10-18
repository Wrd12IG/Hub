import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { askClaude, askClaudeJson, isClaudeConfigured } from '../claude';

const ok = (text: string) => ({ ok: true, json: async () => ({ content: [{ type: 'text', text }] }) }) as any;
const fail = (message: string) => ({ ok: false, statusText: 'err', json: async () => ({ error: { message } }) }) as any;

describe('claude', () => {
    let calls: any[];
    beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'sk-test'; calls = []; });
    afterEach(() => vi.unstubAllGlobals());

    const stub = (...responses: any[]) => vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
        calls.push(JSON.parse(init.body));
        return responses.shift();
    }));

    it('usa Sonnet 5.5, manda system e prompt, restituisce il testo', async () => {
        stub(ok('ciao'));
        expect(await askClaude({ prompt: 'p', system: 's' })).toBe('ciao');
        expect(calls[0]).toMatchObject({ model: 'claude-sonnet-5-5', system: 's', messages: [{ role: 'user', content: 'p' }] });
    });

    it('NON manda temperature: i modelli Claude 5 la rifiutano (errore visto in produzione il 18/10)', async () => {
        stub(ok('x'), ok('y'));
        await askClaude({ prompt: 'p' });
        await askClaudeJson({ prompt: 'p' }).catch(() => {});
        for (const body of calls) expect(body).not.toHaveProperty('temperature');
    });

    it('se il primo modello fallisce ripiega su Haiku 5.5', async () => {
        stub(fail('overloaded'), ok('ok'));
        expect(await askClaude({ prompt: 'p' })).toBe('ok');
        expect(calls.map(c => c.model)).toEqual(['claude-sonnet-5-5', 'claude-haiku-5-5']);
    });

    it('se falliscono tutti, un errore che dice perché', async () => {
        stub(fail('a'), fail('b'));
        await expect(askClaude({ prompt: 'p' })).rejects.toThrow(/Claude non ha risposto.*sonnet-5-5: a.*haiku-5-5: b/);
    });

    it('senza chiave non chiama nessuno', async () => {
        delete process.env.ANTHROPIC_API_KEY;
        stub(ok('x'));
        expect(isClaudeConfigured()).toBe(false);
        await expect(askClaude({ prompt: 'p' })).rejects.toThrow('ANTHROPIC_API_KEY non configurata');
        expect(calls).toHaveLength(0);
    });

    it('askClaudeJson legge JSON anche con recinto markdown o testo intorno, e chiede solo JSON', async () => {
        stub(ok('```json\n{"a":1}\n```'), ok('Ecco: {"b":2} fine'), ok('niente'));
        expect(await askClaudeJson({ prompt: 'p', system: 'base' })).toEqual({ a: 1 });
        expect(calls[0].system).toContain('base');
        expect(calls[0].system).toContain('solo con un oggetto JSON');
        expect(await askClaudeJson({ prompt: 'p' })).toEqual({ b: 2 });
        await expect(askClaudeJson({ prompt: 'p' })).rejects.toThrow('Risposta AI non leggibile');
    });
});
