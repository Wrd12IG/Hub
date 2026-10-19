import { describe, it, expect } from 'vitest';
import { adLibraryLinks, domainOf } from '../ad-library-links';

describe('ad-library-links', () => {
    it('estrae il dominio senza www né percorso', () => {
        expect(domainOf('https://www.spotornocar.it/usato')).toBe('spotornocar.it');
        expect(domainOf('autosilano.it')).toBe('autosilano.it');
        expect(domainOf('')).toBe('');
        expect(domainOf(undefined)).toBe('');
    });

    it('Google usa il dominio, Meta e LinkedIn il nome', () => {
        const l = adLibraryLinks({ nome: 'Spotorno Car', sito: 'https://spotornocar.it/' });
        expect(l.google).toBe('https://adstransparency.google.com/?region=IT&domain=spotornocar.it');
        expect(l.meta).toContain('q=Spotorno%20Car');
        expect(l.meta).toContain('country=IT');
        expect(l.linkedin).toBe('https://www.linkedin.com/ad-library/search?keyword=Spotorno%20Car&countries=IT');
    });

    it('senza sito Google cerca per nome', () => {
        expect(adLibraryLinks({ nome: 'Auto & Co' }).google).toContain('query=Auto%20%26%20Co');
    });
});
