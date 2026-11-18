// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildActionCommand, type ActionContext } from '../outreach-actions';
import { isFreeSignal, parseDiscoverInfo } from '../outreach';

const discover = { providers: ['osm', 'serper'] as ('osm' | 'serper')[], cities: ['Milano', 'Monza', 'Bergamo'], cap: 2 };
const sig = (code: string, costNote: string) => ({ code, label: code, description: '', category: 'sito', status: 'proposed', costNote, companies: 0 });
const NOW = new Date('2026-11-18T12:00:00Z').getTime();
const base: ActionContext = {
    discover,
    signals: [sig('FREE_ONE', 'free: legge la home'), sig('INCL', 'Included'), sig('PAID', '1 credit'), sig('TRICKY', '1 credit (free tiers available)')],
    now: NOW,
};
const estimate = (over: object = {}) => ({ provider: 'serper', cities: ['Milano'], estimatedCost: 0.4, ok: true, requestedAt: '2026-11-18T11:50:00Z', used: false, ...over });

describe('isFreeSignal', () => {
    it('vale solo se la nota COMINCIA con free o included', () => {
        expect(isFreeSignal('free: legge la home')).toBe(true);
        expect(isFreeSignal('  Included')).toBe(true);
        expect(isFreeSignal('1 credit (free tiers available)')).toBe(false);
        expect(isFreeSignal('')).toBe(false);
    });
});

describe('parseDiscoverInfo', () => {
    it('tiene solo provider noti e non lascia salire il tetto', () => {
        const d = parseDiscoverInfo({ providers: ['serper', 'dataforseo_serp', 3], cities: ['Milano', 'A;B', 5], cap: 50 })!;
        expect(d).toEqual({ providers: ['serper'], cities: ['Milano'], cap: 2 });
        expect(parseDiscoverInfo({ providers: ['osm'], cities: [], cap: 0 })!.cap).toBe(0);
        expect(parseDiscoverInfo(null)).toBeNull();
    });
});

describe('discover_estimate', () => {
    it('accetta provider e città del profilo', () => {
        const r = buildActionCommand({ action: 'discover_estimate', provider: 'serper', cities: ['Milano', 'Monza', 'Milano'] }, base);
        expect(r).toEqual({ ok: true, command: { action: 'discover_estimate', provider: 'serper', cities: ['Milano', 'Monza'] } });
    });
    it.each([
        [{ provider: 'dataforseo_serp', cities: [] }],
        [{ provider: 'serper', cities: ['Roma'] }],
        [{ provider: 'serper', cities: ['Milano; ls'] }],
        [{ provider: 'serper', cities: 'Milano' }],
        [{ provider: 'serper', cities: ['Milano', 'Monza', 'Bergamo', 'a', 'b', 'c'] }],
        [{}],
    ])('rifiuta %j', (body) => {
        expect(buildActionCommand({ action: 'discover_estimate', ...body }, base).ok).toBe(false);
    });
    it('rifiuta se il ponte non ha dichiarato nulla o ha spento Discover', () => {
        expect(buildActionCommand({ action: 'discover_estimate', provider: 'osm', cities: [] }, { ...base, discover: null }).ok).toBe(false);
        expect(buildActionCommand({ action: 'discover_estimate', provider: 'osm', cities: [] }, { ...base, discover: { ...discover, cap: 0 } }).ok).toBe(false);
    });
});

describe('discover_run', () => {
    const run = (ctx: Partial<ActionContext> & { estimate?: any } = {}, body: object = { estimateId: 'abc' }) =>
        buildActionCommand({ action: 'discover_run', ...body }, { ...base, estimate: estimate(), ...ctx });

    it('il tetto lo calcola il server: la stima più un quarto, mai oltre il tetto', () => {
        const r = run() as any;
        expect(r.ok).toBe(true);
        expect(r.command).toMatchObject({ provider: 'serper', cities: ['Milano'], maxSpend: 0.5, estimateId: 'abc' });
        expect((run({ estimate: estimate({ estimatedCost: 1.9 }) }) as any).command.maxSpend).toBe(2);
        expect((run({ estimate: estimate({ estimatedCost: 0 }) }) as any).command.maxSpend).toBe(0.05);
    });
    it('il client non può scegliere il tetto', () => {
        expect((run({}, { estimateId: 'abc', maxSpend: 100 }) as any).command.maxSpend).toBe(0.5);
    });
    it('rifiuta una stima mancante, già usata, scaduta, fallita o oltre il tetto', () => {
        expect(run({ estimate: null }).ok).toBe(false);
        expect(run({}, {}).ok).toBe(false);
        expect(run({ estimate: estimate({ used: true }) }).ok).toBe(false);
        expect(run({ estimate: estimate({ requestedAt: '2026-11-18T11:00:00Z' }) }).ok).toBe(false);
        expect(run({ estimate: estimate({ ok: false }) }).ok).toBe(false);
        expect(run({ estimate: estimate({ estimatedCost: null }) }).ok).toBe(false);
        expect(run({ estimate: estimate({ estimatedCost: 2.5 }) }).ok).toBe(false);
    });
    it('riconferma provider e città della stima contro quello che il ponte ammette', () => {
        expect(run({ estimate: estimate({ cities: ['Roma'] }) }).ok).toBe(false);
        expect(run({ estimate: estimate({ provider: 'altro' }) }).ok).toBe(false);
    });
});

describe('signals_set', () => {
    it('accetta solo segnali gratuiti del catalogo', () => {
        expect(buildActionCommand({ action: 'signals_set', codes: ['FREE_ONE', 'INCL', 'FREE_ONE'], status: 'confirmed' }, base))
            .toEqual({ ok: true, command: { action: 'signals_set', codes: ['FREE_ONE', 'INCL'], status: 'confirmed' } });
    });
    it('rifiuta i segnali a pagamento (anche se nominano «free»), quelli sconosciuti e i parametri sbagliati', () => {
        const bad = [
            { codes: ['PAID'], status: 'confirmed' },
            { codes: ['TRICKY'], status: 'confirmed' },
            { codes: ['FREE_ONE', 'PAID'], status: 'confirmed' },
            { codes: ['NOPE'], status: 'confirmed' },
            { codes: [], status: 'confirmed' },
            { codes: ['FREE_ONE'], status: 'boh' },
            { codes: 'FREE_ONE', status: 'confirmed' },
            { codes: Array.from({ length: 41 }, (_, i) => `C${i}`), status: 'confirmed' },
        ];
        for (const b of bad) expect(buildActionCommand({ action: 'signals_set', ...b }, base).ok).toBe(false);
        expect((buildActionCommand({ action: 'signals_set', codes: ['PAID'], status: 'confirmed' }, base) as any).status).toBe(403);
    });
});

describe('azioni sconosciute', () => {
    it('non si inventano comandi', () => {
        for (const action of ['rm', 'discover', 'sending', undefined]) expect(buildActionCommand({ action }, base).ok).toBe(false);
    });
});
