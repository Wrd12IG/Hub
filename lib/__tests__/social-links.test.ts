import { describe, it, expect } from 'vitest';
import { normalizeSocial } from '../social-links';

describe('normalizeSocial', () => {
    it('vuoto o spazi: niente', () => {
        expect(normalizeSocial('instagram', '')).toBeUndefined();
        expect(normalizeSocial('tiktok', '   ')).toBeUndefined();
        expect(normalizeSocial('youtube', undefined)).toBeUndefined();
    });

    it('un nome utente diventa l\'indirizzo del profilo di quella piattaforma', () => {
        expect(normalizeSocial('instagram', '@spotornocar')).toBe('https://www.instagram.com/spotornocar');
        expect(normalizeSocial('tiktok', 'spotornocar')).toBe('https://www.tiktok.com/@spotornocar');
        expect(normalizeSocial('youtube', '@SpotornoCar')).toBe('https://www.youtube.com/@SpotornoCar');
        expect(normalizeSocial('linkedin', 'spotorno-car')).toBe('https://www.linkedin.com/company/spotorno-car');
        expect(normalizeSocial('facebook', 'spotorno.car')).toBe('https://www.facebook.com/spotorno.car');
    });

    it('un id canale YouTube usa /channel/', () => {
        expect(normalizeSocial('youtube', 'UCabcdefghijklmnopqrstuv')).toBe('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv');
    });

    it('un indirizzo, con o senza https, resta quello', () => {
        expect(normalizeSocial('instagram', 'https://www.instagram.com/x/')).toBe('https://www.instagram.com/x/');
        expect(normalizeSocial('tiktok', 'tiktok.com/@x')).toBe('https://tiktok.com/@x');
    });

    it('rifiuta protocolli pericolosi e testo che non è un profilo', () => {
        expect(normalizeSocial('instagram', 'javascript:alert(1)')).toBeUndefined();
        expect(normalizeSocial('facebook', 'data:text/html,<b>x</b>')).toBeUndefined();
        expect(normalizeSocial('linkedin', 'ho scritto una frase')).toBeUndefined();
        expect(normalizeSocial('tiktok', 'a')).toBeUndefined();
    });
});
