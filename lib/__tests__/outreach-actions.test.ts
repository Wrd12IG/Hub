// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildActionCommand, type ActionContext } from '../outreach-actions';
import { isFreeSignal, parseDiscoverInfo } from '../outreach';
import { REGIONS, isKnownPlace, regionData } from '../italy-places';
import { ALL_SECTORS, MAX_SECTORS, SECTOR_GROUPS, isKnownSector } from '../outreach-sectors';

const discover = { providers: ['osm', 'serper'] as ('osm' | 'serper')[], cities: ['Milano', 'Monza', 'Bergamo'], cap: 2, industries: ['Concessionario auto', 'Autosalone'], industryOption: true };
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
        expect(d).toEqual({ providers: ['serper'], cities: ['Milano'], cap: 2, industries: [], industryOption: false });
        expect(parseDiscoverInfo({ providers: ['osm'], cities: [], cap: 1, industries: ['Officina', 'A;B', 4], industryOption: true })).toMatchObject({ industries: ['Officina'], industryOption: true });
        expect(parseDiscoverInfo({ providers: ['osm'], cities: [], cap: 0 })!.cap).toBe(0);
        expect(parseDiscoverInfo(null)).toBeNull();
    });
});

describe('discover_estimate', () => {
    it('accetta provider e città del profilo', () => {
        const r = buildActionCommand({ action: 'discover_estimate', provider: 'serper', cities: ['Milano', 'Monza', 'Milano'] }, base);
        expect(r).toEqual({ ok: true, command: { action: 'discover_estimate', provider: 'serper', cities: ['Milano', 'Monza'], industries: [] } });
    });
    it('accetta regioni e comuni d\'Italia nel formato «Comune, SIGLA», oltre alle città del profilo', () => {
        const cities = ['Lombardia', 'Roma, RM', 'Bolzano, BZ', 'Milano'];
        expect(buildActionCommand({ action: 'discover_estimate', provider: 'serper', cities }, base)).toEqual({ ok: true, command: { action: 'discover_estimate', provider: 'serper', cities, industries: [] } });
    });
    it('fino a 10 luoghi, non di più', () => {
        const ten = Array.from({ length: 10 }, (_, i) => ['Milano, MI', 'Monza, MB', 'Bergamo, BG', 'Brescia, BS', 'Como, CO', 'Lecco, LC', 'Varese, VA', 'Pavia, PV', 'Lodi, LO', 'Cremona, CR'][i]);
        expect(buildActionCommand({ action: 'discover_estimate', provider: 'serper', cities: ten }, base).ok).toBe(true);
        expect(buildActionCommand({ action: 'discover_estimate', provider: 'serper', cities: [...ten, 'Mantova, MN'] }, base).ok).toBe(false);
    });
    it.each([
        [{ provider: 'serper', cities: ['Roma, XX'] }],
        [{ provider: 'serper', cities: ['Milano, RM'] }],
        [{ provider: 'serper', cities: ['Lombardia; Veneto'] }],
        [{ provider: 'serper', cities: ['lombardia'] }],
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

describe('elenco ISTAT dei luoghi', () => {
    it('ha 20 regioni e tutti i comuni', () => {
        expect(REGIONS).toHaveLength(20);
        expect(REGIONS).toContain('Lombardia');
        expect(REGIONS).toContain("Valle d'Aosta"); // normalizzata: senza il nome francese
        const comuni = REGIONS.reduce((n, r) => n + regionData(r)!.province.reduce((m, p) => m + p.comuni.length, 0), 0);
        expect(comuni).toBeGreaterThan(7800);
    });
    it('distingue i comuni con lo stesso nome dalla sigla', () => {
        expect(isKnownPlace('Milano, MI')).toBe(true);
        expect(isKnownPlace('Monza, MB')).toBe(true);
        expect(isKnownPlace('Bolzano, BZ')).toBe(true);
        expect(isKnownPlace('Milano, RM')).toBe(false);
        expect(isKnownPlace('Milano')).toBe(false); // senza sigla non è un comune dell'elenco
        expect(isKnownPlace('')).toBe(false);
    });
    it('regionData sconosciuta -> null', () => { expect(regionData('Atlantide')).toBeNull(); });
});

describe('settori', () => {
    const est = (industries: string[]) => buildActionCommand({ action: 'discover_estimate', provider: 'serper', cities: ['Milano, MI'], industries }, base);

    it('l\'elenco è fisso e senza doppioni', () => {
        expect(SECTOR_GROUPS.map((g) => g.group)).toEqual(['Automotive', 'Altri settori']);
        expect(new Set(ALL_SECTORS).size).toBe(ALL_SECTORS.length);
        expect(isKnownSector('Carrozzeria')).toBe(true);
        expect(isKnownSector('carrozzeria')).toBe(false);
        expect(ALL_SECTORS.every((x) => /^[^;<>\n\r]{2,80}$/.test(x))).toBe(true);
    });
    it('accetta settori dall\'elenco o dal profilo, e nessun settore vale il profilo', () => {
        expect(est(['Officina meccanica', 'Carrozzeria'])).toMatchObject({ ok: true, command: { industries: ['Officina meccanica', 'Carrozzeria'] } });
        expect(est(['Autosalone'])).toMatchObject({ ok: true }); // del profilo
        expect(est([])).toMatchObject({ ok: true, command: { industries: [] } });
    });
    it('rifiuta settori inventati, in eccesso o di tipo sbagliato', () => {
        expect(est(['Settore inventato']).ok).toBe(false);
        expect(est(['Carrozzeria; ls']).ok).toBe(false);
        expect(est(ALL_SECTORS.slice(0, MAX_SECTORS + 1)).ok).toBe(false);
        expect(buildActionCommand({ action: 'discover_estimate', provider: 'serper', cities: [], industries: 'Carrozzeria' }, base).ok).toBe(false);
    });
    it('senza l\'opzione sul server rifiuta i settori con un messaggio chiaro, ma non la ricerca normale', () => {
        const old = { ...base, discover: { ...discover, industryOption: false } };
        const r = buildActionCommand({ action: 'discover_estimate', provider: 'serper', cities: [], industries: ['Carrozzeria'] }, old);
        expect(r.ok).toBe(false);
        expect((r as any).error).toMatch(/opzione/);
        expect(buildActionCommand({ action: 'discover_estimate', provider: 'serper', cities: [], industries: [] }, old).ok).toBe(true);
    });
    it('la ricerca eredita i settori dalla stima, non dal client', () => {
        const e = { provider: 'serper', cities: ['Milano'], industries: ['Carrozzeria'], estimatedCost: 0.4, ok: true, requestedAt: '2026-11-18T11:50:00Z', used: false };
        const r = buildActionCommand({ action: 'discover_run', estimateId: 'abc', industries: ['Ristorante'] }, { ...base, estimate: e }) as any;
        expect(r.ok).toBe(true);
        expect(r.command.industries).toEqual(['Carrozzeria']);
        // e li ricontrolla: una stima con un settore ora non ammesso non diventa una ricerca
        expect(buildActionCommand({ action: 'discover_run', estimateId: 'abc' }, { ...base, estimate: { ...e, industries: ['Inventato'] } }).ok).toBe(false);
    });
});
