import { describe, it, expect } from 'vitest';
import { normalizeCandidates, verifyCandidates, mergeDiscovered, normalizeAdAnalysis, type SavedCompetitor } from '../competitor-discovery';

const page = (url: string, title = 'Sito') => ({ url, html: `<title>${title}</title>`, status: 200 });

describe('competitor-discovery', () => {
    it('normalizeCandidates scarta portali, voci senza nome/URL e doppioni di dominio', () => {
        const out = normalizeCandidates({ competitors: [
            { name: 'Spotorno Car', url: 'www.spotornocar.it', city: 'Milano', why: 'Toyota a Sesto' },
            { name: 'Spotorno bis', url: 'https://SPOTORNOCAR.it/offerte' },
            { name: 'AutoScout', url: 'https://www.autoscout24.it/concessionari/x' },
            { name: 'Pagina Facebook', url: 'https://facebook.com/x' },
            { name: '', url: 'https://nome-mancante.it' },
            { name: 'Senza sito' },
            null,
            { name: 'Finiguerra', url: 'https://www.finiguerra.it', kind: 'concessionaria ufficiale' },
        ] });
        expect(out.map(c => c.name)).toEqual(['Spotorno Car', 'Finiguerra']);
        expect(out[0]).toEqual({ name: 'Spotorno Car', url: 'https://www.spotornocar.it', city: 'Milano', why: 'Toyota a Sesto' });
        expect(normalizeCandidates(null)).toEqual([]);
    });

    it('verifyCandidates tiene solo i siti che rispondono, esclude il cliente e rispetta il massimo', async () => {
        const fetcher = async (url: string) => {
            if (url.includes('morto')) throw new Error('Il sito ha risposto 404');
            return page(url, `Titolo ${url}`);
        };
        const r = await verifyCandidates([
            { name: 'A', url: 'https://a.it', why: 'vicino' },
            { name: 'Morto', url: 'https://morto.it' },
            { name: 'Cliente', url: 'https://www.citymotors.it' },
            { name: 'B', url: 'https://b.it' },
            { name: 'C', url: 'https://c.it' },
        ], { ownDomains: ['citymotors.it'], max: 2, fetcher: fetcher as any });
        expect(r.verified.map(c => c.name)).toEqual(['A', 'B']);
        expect(r.verified[0]).toMatchObject({ verified: true, source: 'claude-web', strength: 'vicino', siteTitle: 'Titolo https://a.it' });
        expect(r.rejected.map(x => x.name).sort()).toEqual(['Cliente', 'Morto']);
        // niente chiavi undefined (Firestore le rifiuta)
        expect(JSON.parse(JSON.stringify(r.verified))).toEqual(r.verified);
    });

    it('mergeDiscovered toglie le voci senza sito, tiene quelle con sito e non duplica i domini', () => {
        const existing: SavedCompetitor[] = [
            { name: 'Altre concessionarie Toyota in Brianza', url: '' } as any,
            { name: 'Generico', url: undefined } as any,
            { name: 'Spotorno', url: 'https://www.spotornocar.it/' },
            { name: 'Scritto a mano', url: '', addedBy: 'u1' } as any,
        ];
        const found: SavedCompetitor[] = [
            { name: 'Spotorno Car', url: 'https://spotornocar.it', verified: true },
            { name: 'Finiguerra', url: 'https://www.finiguerra.it', verified: true },
        ];
        const m = mergeDiscovered(existing, found);
        expect(m.list.map(c => c.name)).toEqual(['Spotorno', 'Scritto a mano', 'Finiguerra']);
        expect(m).toMatchObject({ added: 1, removed: 2 });
        // nulla trovato: niente cambia, non si cancella nulla
        expect(mergeDiscovered(existing, [])).toEqual({ list: existing, added: 0, removed: 0, updated: 0 });
    });

    it('normalizeAdAnalysis limita le liste e non crea undefined', () => {
        const a = normalizeAdAnalysis({ summary: ' Prezzi in evidenza ', angles: ['prezzo', null, ''], hooks: 'non array', ctas: ['Scopri'], weakness: '' });
        expect(a.summary).toBe('Prezzi in evidenza');
        expect(a.analysis).toMatchObject({ angles: ['prezzo'], hooks: [], ctas: ['Scopri'], offers: [] });
        expect(normalizeAdAnalysis(null).analysis.angles).toEqual([]);
    });

    it('normalizeCandidates tiene il punto debole solo se scritto', () => {
        const r = normalizeCandidates({ competitors: [
            { name: 'A', url: 'https://a-auto.it', weak: ' Recensioni lente sul post-vendita ' },
            { name: 'B', url: 'https://b-auto.it', weak: '' },
        ] });
        expect(r[0].weak).toBe('Recensioni lente sul post-vendita');
        expect(r[1]).not.toHaveProperty('weak');
    });

    it('mergeDiscovered completa i campi vuoti di chi c\'era già e non sovrascrive quelli scritti', () => {
        const existing = [
            { name: 'A', url: 'https://a-auto.it' },
            { name: 'B', url: 'https://b-auto.it', weakness: 'scritto da una persona' },
        ] as SavedCompetitor[];
        const found = [
            { name: 'A', url: 'https://a-auto.it', weakness: 'sito senza prezzi', strength: 'vicino' },
            { name: 'B', url: 'https://b-auto.it', weakness: 'altro' },
        ] as SavedCompetitor[];
        const m = mergeDiscovered(existing, found);
        expect(m.updated).toBe(1);
        expect(m.added).toBe(0);
        expect(m.list[0]).toMatchObject({ weakness: 'sito senza prezzi', strength: 'vicino' });
        expect(m.list[1].weakness).toBe('scritto da una persona');
    });
});

import { buildAnalysisPrompt, normalizeAnalysis } from '../competitor-discovery';

describe('analisi di un competitor', () => {
    it('il prompt chiede fonti e vieta di inventare', () => {
        const p = buildAnalysisPrompt({ competitor: 'Rivauto', url: 'https://rivauto.it', client: 'City Motors' });
        expect(p).toContain('Rivauto');
        expect(p).toMatch(/non inventare/i);
        expect(p).toContain('sources');
    });

    it('normalizeAnalysis tiene solo URL veri e taglia gli spazi', () => {
        const a = normalizeAnalysis({ strength: ' Ampia gamma ', weakness: '', sources: ['https://a.it/x', 'non un url', 5, 'http://b.it'], note: ' nessuna evidenza ' });
        expect(a).toEqual({ strength: 'Ampia gamma', weakness: '', sources: ['https://a.it/x', 'http://b.it'], note: 'nessuna evidenza' });
        expect(normalizeAnalysis(null)).toEqual({ strength: '', weakness: '', sources: [], note: '' });
    });
});
