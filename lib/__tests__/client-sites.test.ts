import { describe, it, expect } from 'vitest';
import {
    sitesOf, findSite, brandsOf, filterByBrand, legacyFromSites, applyLegacyPatch, sitesAfterLegacyEdit, normalizeUrl, validateSites, siteLabel, reportTargets, MAIN_SITE_ID, MAX_SITES, type ClientSite,
} from '../client-sites';

const site = (id: string, over: Partial<ClientSite> = {}): ClientSite => ({ id, url: `https://${id}.it`, ...over });

describe('sitesOf', () => {
    it('un cliente senza siti salvati ha un sito «virtuale» ricavato dai campi vecchi', () => {
        const s = sitesOf({ websiteUrl: 'https://www.esempio.it', ga4PropertyId: '123456789', windsorAccounts: { searchconsole: 'sc-domain:esempio.it' } });
        expect(s).toEqual([{ id: MAIN_SITE_ID, url: 'https://www.esempio.it', ga4PropertyId: '123456789', searchConsole: 'sc-domain:esempio.it' }]);
    });
    it('anche con un solo campo vecchio compilato', () => {
        expect(sitesOf({ ga4PropertyId: '123456789' })).toEqual([{ id: MAIN_SITE_ID, url: '', ga4PropertyId: '123456789' }]);
    });
    it('senza niente: nessun sito', () => {
        expect(sitesOf({})).toEqual([]);
        expect(sitesOf(null)).toEqual([]);
        expect(sitesOf({ websiteUrl: '  ', ga4PropertyId: null, windsorAccounts: { searchconsole: '' } })).toEqual([]);
    });
    it('con i siti salvati usa quelli e ignora i campi vecchi', () => {
        const s = sitesOf({ websiteUrl: 'https://vecchio.it', sites: [site('a', { brand: 'Renault' }), site('b')] });
        expect(s.map((x) => x.id)).toEqual(['a', 'b']);
    });
    it('scarta le voci rotte e i doppioni di id; se non resta nulla ripiega sui campi vecchi', () => {
        expect(sitesOf({ sites: [null, 'x', { url: 'https://x.it' }, site('a'), site('a')] }).map((x) => x.id)).toEqual(['a']);
        expect(sitesOf({ websiteUrl: 'https://vecchio.it', sites: [null, {}] }).map((x) => x.id)).toEqual([MAIN_SITE_ID]);
    });
});

describe('findSite', () => {
    const client = { sites: [site('a'), site('b')] };
    it('per id, e senza id il primo', () => {
        expect(findSite(client, 'b')?.id).toBe('b');
        expect(findSite(client)?.id).toBe('a');
        expect(findSite(client, null)?.id).toBe('a');
    });
    it('un id che non esiste non ripiega sul primo: meglio un «non trovato» che i dati di un altro sito', () => {
        expect(findSite(client, 'zzz')).toBeNull();
    });
    it('un cliente senza siti: null', () => {
        expect(findSite({}, undefined)).toBeNull();
    });
});

describe('marche', () => {
    const sites = [site('a', { brand: 'Renault' }), site('b', { brand: 'dacia' }), site('c', { brand: ' Dacia ' }), site('d')];
    it('brandsOf: senza doppioni (anche con maiuscole diverse), in ordine, senza i siti senza marca', () => {
        expect(brandsOf(sites)).toEqual(['dacia', 'Renault']);
    });
    it('filterByBrand: per marca senza badare alle maiuscole; senza marca tutti', () => {
        expect(filterByBrand(sites, 'DACIA').map((s) => s.id)).toEqual(['b', 'c']);
        expect(filterByBrand(sites, null)).toHaveLength(4);
        expect(filterByBrand(sites, '')).toHaveLength(4);
        expect(filterByBrand(sites, 'Nissan')).toEqual([]);
    });
});

describe('sincronia con i campi vecchi', () => {
    it('legacyFromSites: i campi vecchi sono quelli del primo sito', () => {
        expect(legacyFromSites([site('a', { ga4PropertyId: '111111', searchConsole: 'sc-domain:a.it' }), site('b', { ga4PropertyId: '222222' })]))
            .toEqual({ websiteUrl: 'https://a.it', ga4PropertyId: '111111', searchConsole: 'sc-domain:a.it' });
        expect(legacyFromSites([])).toEqual({ websiteUrl: null, ga4PropertyId: null, searchConsole: null });
    });
    it('applyLegacyPatch: cambia solo il primo sito e solo i campi presenti', () => {
        const before = [site('a', { ga4PropertyId: '111111', brand: 'X' }), site('b', { ga4PropertyId: '222222' })];
        const after = applyLegacyPatch(before, { ga4PropertyId: '999999' });
        expect(after[0]).toEqual({ id: 'a', url: 'https://a.it', brand: 'X', ga4PropertyId: '999999' });
        expect(after[1]).toEqual(before[1]);
        expect(before[0].ga4PropertyId).toBe('111111'); // l'originale non si tocca
    });
    it('un campo presente ma vuoto si toglie', () => {
        const after = applyLegacyPatch([site('a', { ga4PropertyId: '111111', searchConsole: 'sc-domain:a.it' })], { searchConsole: '' });
        expect(after[0].searchConsole).toBeUndefined();
        expect(after[0].ga4PropertyId).toBe('111111');
    });
    it('senza siti nasce il sito «main»', () => {
        expect(applyLegacyPatch([], { websiteUrl: 'https://nuovo.it' })).toEqual([{ id: MAIN_SITE_ID, url: 'https://nuovo.it' }]);
    });
    it('un primo sito rimasto vuoto sparisce', () => {
        expect(applyLegacyPatch([site('a')], { websiteUrl: '' })).toEqual([]);
    });
});

describe('normalizeUrl', () => {
    it('aggiunge https e toglie la barra finale', () => {
        expect(normalizeUrl('www.esempio.it/')).toBe('https://www.esempio.it');
        expect(normalizeUrl('http://esempio.it')).toBe('http://esempio.it');
        expect(normalizeUrl(' esempio.it/negozio/ ')).toBe('https://esempio.it/negozio');
    });
    it('non accetta ciò che non è un indirizzo', () => {
        for (const v of ['', 'ciao', 'a b.it', 'https://', null, undefined, 42]) expect(normalizeUrl(v)).toBe('');
    });
});

describe('validateSites', () => {
    const ok = (input: unknown, ids: string[] = []) => {
        const r = validateSites(input, ids);
        if (!r.ok) throw new Error(r.error);
        return r.sites;
    };
    const err = (input: unknown, ids: string[] = []) => {
        const r = validateSites(input, ids);
        return r.ok ? null : r.error;
    };

    it('ripulisce e dà un id ai siti nuovi', () => {
        const s = ok([{ url: 'www.renault.it', brand: ' Renault ', ga4PropertyId: '345678901', searchConsole: 'sc-domain:renault.it' }]);
        expect(s).toHaveLength(1);
        expect(s[0]).toMatchObject({ url: 'https://www.renault.it', brand: 'Renault', ga4PropertyId: '345678901', searchConsole: 'sc-domain:renault.it' });
        expect(s[0].id).toMatch(/^s[a-z0-9]{1,6}$/);
    });
    it('conserva gli id già del cliente e ne ignora uno inventato dal browser', () => {
        const s = ok([{ id: 'a', url: 'a.it' }, { id: 'inventato', url: 'b.it' }], ['a']);
        expect(s[0].id).toBe('a');
        expect(s[1].id).not.toBe('inventato');
    });
    it('un id usato due volte nello stesso elenco non si duplica', () => {
        const s = ok([{ id: 'a', url: 'a.it' }, { id: 'a', url: 'b.it' }], ['a']);
        expect(new Set(s.map((x) => x.id)).size).toBe(2);
    });
    it('rifiuta indirizzo non valido, doppioni e troppi siti', () => {
        expect(err([{ url: 'boh' }])).toContain('Sito 1');
        expect(err([{ url: 'a.it' }, { url: 'https://A.it/' }])).toContain('già nell\'elenco');
        expect(err(Array.from({ length: MAX_SITES + 1 }, (_, i) => ({ url: `s${i}.it` })))).toContain('Al massimo');
        expect(err('no')).toBeTruthy();
        expect(err([null])).toContain('Sito 1');
    });
    it('rifiuta un GA4 che non è un numero e una Search Console scritta male', () => {
        expect(err([{ url: 'a.it', ga4PropertyId: 'G-ABC123' }])).toContain('Property ID');
        expect(err([{ url: 'a.it', ga4PropertyId: 'utente@mail.it' }])).toContain('Property ID');
        expect(err([{ url: 'a.it', searchConsole: 'a.it' }])).toContain('Search Console');
        expect(err([{ url: 'a.it', searchConsole: 'https://a.it' }])).toContain('Search Console'); // manca la barra finale
    });
    it('accetta una Search Console con URL completo', () => {
        expect(ok([{ url: 'a.it', searchConsole: 'https://www.a.it/' }])[0].searchConsole).toBe('https://www.a.it/');
    });
    it('una marca troppo lunga è un errore; l\'elenco vuoto è valido (toglie tutti i siti)', () => {
        expect(err([{ url: 'a.it', brand: 'x'.repeat(41) }])).toContain('marca');
        expect(ok([])).toEqual([]);
    });
});

describe('sitesAfterLegacyEdit', () => {
    const client = { sites: [site('a', { ga4PropertyId: '111111' }), site('b', { ga4PropertyId: '222222' })] };
    it('una modifica a GA4 dalla scheda Setup API finisce sul primo sito', () => {
        const r = sitesAfterLegacyEdit(client, { ga4PropertyId: '999999' })!;
        expect(r[0].ga4PropertyId).toBe('999999');
        expect(r[1].ga4PropertyId).toBe('222222');
    });
    it('la Search Console arriva come percorso puntato o dentro windsorAccounts', () => {
        expect(sitesAfterLegacyEdit(client, { 'windsorAccounts.searchconsole': 'sc-domain:a.it' })![0].searchConsole).toBe('sc-domain:a.it');
        expect(sitesAfterLegacyEdit(client, { windsorAccounts: { searchconsole: 'sc-domain:b.it' } })![0].searchConsole).toBe('sc-domain:b.it');
    });
    it('il dominio dalla scheda cliente', () => {
        expect(sitesAfterLegacyEdit(client, { websiteUrl: 'https://nuovo.it' })![0].url).toBe('https://nuovo.it');
    });
    it('un campo non legato ai siti non cambia nulla', () => {
        expect(sitesAfterLegacyEdit(client, { metaAdAccountId: '123' })).toBeNull();
        expect(sitesAfterLegacyEdit(client, { 'windsorAccounts.instagram': 'x' })).toBeNull();
    });
    it('un cliente senza siti salvati: null (i campi vecchi bastano)', () => {
        expect(sitesAfterLegacyEdit({ websiteUrl: 'https://a.it' }, { ga4PropertyId: '111111' })).toBeNull();
        expect(sitesAfterLegacyEdit({ sites: [] }, { ga4PropertyId: '111111' })).toBeNull();
        expect(sitesAfterLegacyEdit(null, { ga4PropertyId: '111111' })).toBeNull();
    });
});

describe('siteLabel', () => {
    it('marca e indirizzo, o solo l\'indirizzo, o l\'id', () => {
        expect(siteLabel({ id: 'a', url: 'https://www.renault.it', brand: 'Renault' })).toBe('Renault · www.renault.it');
        expect(siteLabel({ id: 'a', url: 'https://www.dacia.it' })).toBe('www.dacia.it');
        expect(siteLabel({ id: 'a', url: '' })).toBe('a');
    });
});

describe('reportTargets', () => {
    it('un sito solo: come sempre, senza etichetta', () => {
        expect(reportTargets({ websiteUrl: 'https://a.it', ga4PropertyId: '111111', windsorAccounts: { searchconsole: 'sc-domain:a.it' } }))
            .toEqual({ ga4: [{ id: '111111' }], searchConsole: [{ id: 'sc-domain:a.it' }] });
    });
    it('più siti: uno per sito, con l\'etichetta per distinguerli', () => {
        const t = reportTargets({ sites: [
            { id: 'a', url: 'https://www.renault.it', brand: 'Renault', ga4PropertyId: '111111', searchConsole: 'sc-domain:renault.it' },
            { id: 'b', url: 'https://www.dacia.it', brand: 'Dacia', ga4PropertyId: '222222' },
        ] });
        expect(t.ga4).toEqual([{ id: '111111', label: 'Renault · www.renault.it' }, { id: '222222', label: 'Dacia · www.dacia.it' }]);
        expect(t.searchConsole).toEqual([{ id: 'sc-domain:renault.it' }]); // una sola Search Console: nessuna etichetta
    });
    it('due siti sulla stessa proprietà contano una volta (niente conteggi doppi)', () => {
        const t = reportTargets({ sites: [site('a', { ga4PropertyId: '111111' }), site('b', { ga4PropertyId: '111111' })] });
        expect(t.ga4).toEqual([{ id: '111111' }]);
    });
    it('un sito senza Analytics non entra tra i bersagli', () => {
        const t = reportTargets({ sites: [site('a'), site('b', { ga4PropertyId: '222222' })] });
        expect(t.ga4).toEqual([{ id: '222222' }]);
    });
    it('senza siti né campi vecchi: nessun bersaglio', () => {
        expect(reportTargets({})).toEqual({ ga4: [], searchConsole: [] });
        expect(reportTargets(null)).toEqual({ ga4: [], searchConsole: [] });
    });
});
