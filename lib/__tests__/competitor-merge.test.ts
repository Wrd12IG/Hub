import { describe, it, expect } from 'vitest';
import { domainOf, mergeCompetitors, type MonitoredCompetitor } from '../competitor-merge';

const existing: MonitoredCompetitor[] = [{ id: 'c1', nome: 'Rivale', sito: 'https://www.rivale.it/' }];

describe('competitor-merge', () => {
    it('domainOf riconosce lo stesso sito scritto in modi diversi', () => {
        expect(domainOf('https://www.Esempio.it/pagina')).toBe('esempio.it');
        expect(domainOf('esempio.it')).toBe('esempio.it');
        expect(domainOf('')).toBe('');
        expect(domainOf('http://')).toBe('');
    });

    it('aggiunge solo chi ha il sito, salta i doppioni per dominio e i senza sito', () => {
        const r = mergeCompetitors(existing, [
            { name: 'Rivale bis', url: 'rivale.it' },        // doppione di c1 (www/senza schema)
            { name: 'Nuovo', url: 'nuovo.it' },
            { name: 'Senza sito' },
            { name: 'Nuovo di nuovo', url: 'https://NUOVO.it/chi-siamo' }, // doppione di quello appena aggiunto
        ]);
        expect(r.added).toEqual([{ nome: 'Nuovo', sito: 'https://nuovo.it' }]);
        expect(r.skippedDuplicate).toEqual(['Rivale bis', 'Nuovo di nuovo']);
        expect(r.skippedNoUrl).toEqual(['Senza sito']);
        expect(r.merged.map(c => c.id)).toEqual(['c1', 'c2']);
    });

    it('rispetta il massimo di 5 e segnala chi resta fuori', () => {
        const incoming = ['a', 'b', 'c', 'd', 'e', 'f'].map(x => ({ name: x, url: `${x}.it` }));
        const r = mergeCompetitors(existing, incoming);
        expect(r.merged).toHaveLength(5);
        expect(r.added).toHaveLength(4);
        expect(r.skippedFull).toEqual(['e', 'f']);
    });

    it('gli id non si sovrappongono a quelli esistenti', () => {
        const r = mergeCompetitors([{ id: 'c2', nome: 'X', sito: 'https://x.it' }], [{ name: 'Y', url: 'y.it' }]);
        expect(r.merged.map(c => c.id)).toEqual(['c2', 'c3']);
    });
});
