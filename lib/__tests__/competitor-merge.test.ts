import { describe, it, expect } from 'vitest';
import { domainOf, mergeCompetitors, sameBusinessName, type MonitoredCompetitor } from '../competitor-merge';

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

    it('non aggiunge la stessa azienda con un altro sito (Autosilano con due domini)', () => {
        const existing: MonitoredCompetitor[] = [{ id: 'c1', nome: 'Autosilano', sito: 'https://autosilano.it' }];
        const r = mergeCompetitors(existing, [
            { name: 'Autosilano', url: 'https://autosilanotoyota.it' },
            { name: 'Autosilano Toyota', url: 'https://autosilanotoyota.it' },
            { name: 'Sarco di Arrigoni', url: 'https://sarcodiarrigoni.it' },
        ]);
        expect(r.skippedDuplicate).toEqual(['Autosilano', 'Autosilano Toyota']);
        expect(r.added.map(a => a.nome)).toEqual(['Sarco di Arrigoni']);
    });

    it('sameBusinessName: parole intere, nomi corti mai uguali', () => {
        expect(sameBusinessName('Autosilano', 'autosilano toyota')).toBe(true);
        expect(sameBusinessName('Auto Più', 'AUTO PIU')).toBe(true);
        expect(sameBusinessName('Auto', 'Autosilano')).toBe(false);
        expect(sameBusinessName('Sarco', 'Sarcoli Auto')).toBe(false);
        expect(sameBusinessName('ab', 'ab')).toBe(false);
    });
});
