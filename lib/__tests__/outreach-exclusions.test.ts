// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildExclusionBatch, buildExclusionCommand, cleanDomain, MAX_BATCH, MAX_EXCLUSIONS, parseExclusions } from '../outreach-exclusions';
import { parseCompanyItem } from '../outreach';

describe('cleanDomain', () => {
    it('normalizza come fa Sellbird: minuscolo, senza schema, percorso e www', () => {
        expect(cleanDomain('Rimor.IT')).toBe('rimor.it');
        expect(cleanDomain('https://www.Rimor.it/chi-siamo')).toBe('rimor.it');
        expect(cleanDomain('  shop.rimor.it ')).toBe('shop.rimor.it');
    });
    it.each(['', 'rimor', 'rimor.', '.it', 'a b.it', '*.it', 'rimor.it; ls', 'mario@rimor.it', 'rimor.i', '-rimor.it', 'x'.repeat(120) + '.it', 5, null, undefined, {}])(
        'rifiuta %p', (v) => expect(cleanDomain(v as any)).toBeNull());
});

describe('buildExclusionCommand', () => {
    const ctx = { knownCompany: true, exclusions: ['gia.it'] };
    it('add: un dominio di un\'azienda che la hub conosce', () => {
        expect(buildExclusionCommand({ action: 'add', domain: 'Rimor.it' }, ctx)).toEqual({ ok: true, command: { action: 'dnc_add', domain: 'rimor.it' } });
    });
    it('add: rifiuta un dominio sconosciuto, già in lista, o non valido', () => {
        const unknown = buildExclusionCommand({ action: 'add', domain: 'rimor.it' }, { ...ctx, knownCompany: false }) as any;
        expect([unknown.ok, unknown.status]).toEqual([false, 404]);
        const listed = buildExclusionCommand({ action: 'add', domain: 'gia.it' }, ctx) as any;
        expect([listed.ok, listed.status]).toEqual([false, 409]);
        expect(buildExclusionCommand({ action: 'add', domain: 'non un dominio' }, ctx).ok).toBe(false);
    });
    it('add: non supera la lunghezza massima', () => {
        const full = Array.from({ length: MAX_EXCLUSIONS }, (_, i) => `d${i}.it`);
        expect(buildExclusionCommand({ action: 'add', domain: 'nuovo.it' }, { knownCompany: true, exclusions: full }).ok).toBe(false);
    });
    it('remove: solo un dominio che è davvero in lista', () => {
        expect(buildExclusionCommand({ action: 'remove', domain: 'gia.it' }, ctx)).toEqual({ ok: true, command: { action: 'dnc_remove', domain: 'gia.it' } });
        expect((buildExclusionCommand({ action: 'remove', domain: 'altro.it' }, ctx) as any).status).toBe(409);
    });
    it('remove non richiede che l\'azienda sia nota: si può riammettere anche se è sparita dall\'elenco', () => {
        expect(buildExclusionCommand({ action: 'remove', domain: 'gia.it' }, { knownCompany: false, exclusions: ['gia.it'] }).ok).toBe(true);
    });
    it('azioni sconosciute', () => {
        for (const action of ['rm', 'dnc_add', undefined]) expect(buildExclusionCommand({ action, domain: 'gia.it' }, ctx).ok).toBe(false);
    });
});

describe('parseExclusions', () => {
    it('tiene solo domini validi, in minuscolo e senza doppioni; scarta indirizzi, voci con www o schema, e il resto', () => {
        expect(parseExclusions(['rimor.it', 'rimor.it', 'Maiuscolo.it', 'mario@altro.it', 'non un dominio', 5, null, 'www.x.it', 'https://y.it', 'ok.example.com']))
            .toEqual(['rimor.it', 'maiuscolo.it', 'ok.example.com']);
    });
    it('non fallisce su dati assenti e rispetta il limite', () => {
        expect(parseExclusions(undefined)).toEqual([]);
        expect(parseExclusions('rimor.it')).toEqual([]);
        expect(parseExclusions(Array.from({ length: 800 }, (_, i) => `d${i}.it`))).toHaveLength(MAX_EXCLUSIONS);
    });
});

describe('azienda esclusa', () => {
    it('parseCompanyItem legge excluded solo se è vero', () => {
        expect(parseCompanyItem({ id: 'c1c1', name: 'A', excluded: true })!.excluded).toBe(true);
        expect(parseCompanyItem({ id: 'c1c1', name: 'A', excluded: 'yes' })!.excluded).toBe(false);
        expect(parseCompanyItem({ id: 'c1c1', name: 'A' })!.excluded).toBe(false);
    });
});

describe('buildExclusionBatch: più modifiche insieme', () => {
    const ctx = { knownDomains: new Set(['a.it', 'b.it', 'c.it']), exclusions: ['gia.it', 'altra.it'] };
    const add = (domain: string) => ({ action: 'add', domain });
    const remove = (domain: string) => ({ action: 'remove', domain });

    it('accetta escludi e riammetti insieme, normalizzando i domini', () => {
        const r = buildExclusionBatch({ changes: [add('A.it'), add('https://www.b.it/x'), remove('gia.it')] }, ctx) as any;
        expect(r.ok).toBe(true);
        expect(r.changes).toEqual([{ action: 'add', domain: 'a.it' }, { action: 'add', domain: 'b.it' }, { action: 'remove', domain: 'gia.it' }]);
        expect(r.skipped).toBe(0);
    });
    it('salta senza errore quello che è già a posto (un altro gruppo può averlo applicato nel frattempo)', () => {
        const r = buildExclusionBatch({ changes: [add('gia.it'), remove('mai-stata.it'), add('a.it')] }, ctx) as any;
        expect(r.ok).toBe(true);
        expect(r.changes).toEqual([{ action: 'add', domain: 'a.it' }]);
        expect(r.skipped).toBe(2);
    });
    it('se è tutto già a posto, risponde «niente da fare» e non crea un comando', () => {
        const r = buildExclusionBatch({ changes: [add('gia.it'), remove('mai-stata.it')] }, ctx) as any;
        expect([r.ok, r.status]).toEqual([false, 409]);
    });
    it('tutto o niente: un dominio sbagliato, sconosciuto o doppio ferma il gruppo', () => {
        const bad = [
            [add('a.it'), add('non un dominio')],
            [add('a.it'), { action: 'boh', domain: 'b.it' }],
            [add('a.it'), add('A.IT')],                       // lo stesso dominio due volte
            [add('a.it'), add('sconosciuta.it')],             // la hub non l'ha mai visto
            [add('a.it'), 'non un oggetto'],
            [add('a.it'), { action: 'add' }],
        ];
        for (const changes of bad) expect(buildExclusionBatch({ changes }, ctx).ok).toBe(false);
        expect((buildExclusionBatch({ changes: [add('sconosciuta.it')] }, ctx) as any).status).toBe(404);
    });
    it('riammettere non richiede che la hub conosca l\'azienda', () => {
        expect(buildExclusionBatch({ changes: [remove('gia.it')] }, { knownDomains: new Set(), exclusions: ['gia.it'] }).ok).toBe(true);
    });
    it('rifiuta un gruppo vuoto, non valido o troppo grande', () => {
        for (const body of [{}, { changes: [] }, { changes: 'add' }, { changes: null }, null, undefined]) expect(buildExclusionBatch(body as any, ctx).ok).toBe(false);
        const many = Array.from({ length: MAX_BATCH + 1 }, (_, i) => add(`d${i}.it`));
        expect(buildExclusionBatch({ changes: many }, { knownDomains: new Set(many.map((c) => c.domain)), exclusions: [] }).ok).toBe(false);
        const maxOk = Array.from({ length: MAX_BATCH }, (_, i) => add(`d${i}.it`));
        expect(buildExclusionBatch({ changes: maxOk }, { knownDomains: new Set(maxOk.map((c) => c.domain)), exclusions: [] }).ok).toBe(true);
    });
    it('non supera la lunghezza massima della lista, contando le riammissioni dello stesso gruppo', () => {
        const full = Array.from({ length: MAX_EXCLUSIONS }, (_, i) => `d${i}.it`);
        const c = { knownDomains: new Set(['nuovo.it']), exclusions: full };
        expect(buildExclusionBatch({ changes: [add('nuovo.it')] }, c).ok).toBe(false);
        expect(buildExclusionBatch({ changes: [add('nuovo.it'), remove('d0.it')] }, c).ok).toBe(true);
    });
});
