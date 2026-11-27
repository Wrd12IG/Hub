import { describe, it, expect } from 'vitest';
import { parseStrategyDay, productionTypesForMedia, channelsFromPlatform } from '../strategy-to-ped';

const now = new Date(2026, 10, 27); // 27 novembre 2026

describe('parseStrategyDay', () => {
    it('formati numerici', () => {
        expect(parseStrategyDay('2026-12-03', now)).toBe('2026-12-03');
        expect(parseStrategyDay('03/12/2026', now)).toBe('2026-12-03');
    });
    it('giorno e mese in italiano', () => {
        expect(parseStrategyDay('Giovedì 3 Dicembre', now)).toBe('2026-12-03');
    });
    it('mese già passato: anno dopo', () => {
        expect(parseStrategyDay('Lunedì 12 gennaio', now)).toBe('2027-01-12');
    });
    it('solo il giorno: questo mese o il prossimo', () => {
        expect(parseStrategyDay('Domenica 30', now)).toBe('2026-11-30');
        expect(parseStrategyDay('Lunedì 1', now)).toBe('2026-12-01');
    });
    it('testo senza data: null', () => {
        expect(parseStrategyDay('Settimana 2', now)).toBeNull();
        expect(parseStrategyDay('', now)).toBeNull();
    });
});

describe('productionTypesForMedia e canali', () => {
    it('lavorazioni', () => {
        expect(productionTypesForMedia('Video/Reel')).toEqual(['video']);
        expect(productionTypesForMedia('Foto')).toEqual(['photo']);
        expect(productionTypesForMedia('Carosello')).toEqual(['graphic']);
    });
    it('canali', () => {
        expect(channelsFromPlatform('Instagram Stories', 'Storia')).toMatchObject({ igStories: true, instagram: false });
        expect(channelsFromPlatform('Instagram + Facebook', 'Carosello')).toMatchObject({ instagram: true, facebook: true, igStories: false });
    });
});
