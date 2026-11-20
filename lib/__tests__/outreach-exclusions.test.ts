// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildExclusionCommand, cleanDomain, MAX_EXCLUSIONS, parseExclusions } from '../outreach-exclusions';
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
