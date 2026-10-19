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

    it('Meta: con l\'ID della pagina Facebook salvata apre gli annunci di quella pagina', () => {
        const l = adLibraryLinks({ nome: 'Rivauto', facebook: 'https://www.facebook.com/profile.php?id=100012345678901' });
        expect(l.meta).toContain('view_all_page_id=100012345678901');
        expect(l.basis.meta).toBe('pagina');
    });

    it('Meta: senza ID usa il nome del profilo salvato, più distintivo del nome commerciale', () => {
        const l = adLibraryLinks({ nome: 'Autotorino Toyota Milano', facebook: 'https://www.facebook.com/autotorino' });
        expect(l.meta).toContain('q=autotorino&');
        expect(l.basis.meta).toBe('nome profilo');
        expect(adLibraryLinks({ nome: 'Rivauto' }).basis.meta).toBe('nome');
    });

    it('LinkedIn: usa il nome dell\'azienda dal link salvato', () => {
        const l = adLibraryLinks({ nome: 'Spotorno Car', linkedin: 'https://www.linkedin.com/company/spotorno-car/' });
        expect(l.linkedin).toContain('keyword=spotorno%20car');
        expect(l.basis.linkedin).toBe('nome profilo');
    });
});
