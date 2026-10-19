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

import { parseDataUrlImage } from '../claude';

describe('claude: immagini e ricerca web', () => {
    beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'sk-test'; });
    afterEach(() => vi.unstubAllGlobals());

    const capture = (response: any) => {
        const bodies: any[] = [];
        vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => { bodies.push(JSON.parse(init.body)); return response; }));
        return bodies;
    };

    it('manda le immagini come blocchi prima del testo', async () => {
        const bodies = capture({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) });
        await askClaude({ prompt: 'cosa vedi?', images: [{ mediaType: 'image/png', data: 'AAAA' }] });
        expect(bodies[0].messages[0].content).toEqual([
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } },
            { type: 'text', text: 'cosa vedi?' },
        ]);
    });

    it('con webSearch aggiunge lo strumento e unisce tutti i blocchi di testo', async () => {
        const bodies = capture({ ok: true, json: async () => ({ content: [
            { type: 'text', text: 'Cerco...' }, { type: 'server_tool_use', name: 'web_search' },
            { type: 'web_search_tool_result' }, { type: 'text', text: '{"a":1}' },
        ] }) });
        const out = await askClaude({ prompt: 'p', webSearch: { maxUses: 3 } });
        expect(bodies[0].tools).toEqual([{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]);
        expect(out).toBe('Cerco...\n{"a":1}');
    });

    it('senza immagini né ricerca: nessun tools e contenuto semplice (come prima)', async () => {
        const bodies = capture({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'x' }] }) });
        await askClaude({ prompt: 'p' });
        expect(bodies[0]).not.toHaveProperty('tools');
        expect(bodies[0].messages[0].content).toBe('p');
    });

    it('parseDataUrlImage accetta solo immagini supportate e non troppo grandi', () => {
        expect(parseDataUrlImage('data:image/jpeg;base64,/9j/4AAQ')).toEqual({ mediaType: 'image/jpeg', data: '/9j/4AAQ' });
        expect(parseDataUrlImage('data:image/jpg;base64,AAAA')?.mediaType).toBe('image/jpeg');
        expect(parseDataUrlImage('data:image/svg+xml;base64,AAAA')).toBeNull();
        expect(parseDataUrlImage('data:text/plain;base64,AAAA')).toBeNull();
        expect(parseDataUrlImage('non è un data url')).toBeNull();
        expect(parseDataUrlImage('data:image/png;base64,' + 'A'.repeat(7_000_000))).toBeNull();
    });

    it('toglie i marcatori di citazione della ricerca web dal testo', async () => {
        const tagged = 'Una lacuna. ' + '<' + 'cite index="2-3">Le recensioni sono lente.</' + 'cite> Fine.';
        capture({ ok: true, json: async () => ({ content: [{ type: 'text', text: tagged }] }) });
        expect(await askClaude({ prompt: 'p', webSearch: { maxUses: 2 } })).toBe('Una lacuna. Le recensioni sono lente. Fine.');
    });
});
