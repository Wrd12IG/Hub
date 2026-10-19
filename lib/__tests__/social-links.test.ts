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

import { socialHandle, facebookPageId } from '../social-links';

describe('socialHandle e facebookPageId', () => {
    it('ricava il nome del profilo dal link salvato', () => {
        expect(socialHandle('https://www.instagram.com/SpotornoCar/')).toBe('spotornocar');
        expect(socialHandle('https://www.tiktok.com/@spotornocar')).toBe('spotornocar');
        expect(socialHandle('https://www.youtube.com/@SpotornoCar')).toBe('spotornocar');
        expect(socialHandle('https://www.linkedin.com/company/spotorno-car/')).toBe('spotorno-car');
        expect(socialHandle('https://www.facebook.com/people/Spotorno-Car/100012345678901/')).toBe('spotorno-car');
    });

    it('niente nome quando il link non ne ha uno utilizzabile', () => {
        expect(socialHandle('https://www.facebook.com/profile.php?id=100012345678901')).toBeUndefined();
        expect(socialHandle('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv')).toBeUndefined();
        expect(socialHandle('@spotornocar')).toBeUndefined();
        expect(socialHandle(undefined)).toBeUndefined();
    });

    it('l\'ID pagina Facebook solo se il link lo contiene davvero', () => {
        expect(facebookPageId('https://www.facebook.com/profile.php?id=100012345678901')).toBe('100012345678901');
        expect(facebookPageId('https://www.facebook.com/pages/Spotorno-Car/123456789012345')).toBe('123456789012345');
        expect(facebookPageId('https://www.facebook.com/spotornocar')).toBeUndefined();
        expect(facebookPageId('https://www.facebook.com/spotornocar2023')).toBeUndefined();
    });
});
