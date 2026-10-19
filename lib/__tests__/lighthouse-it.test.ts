import { describe, it, expect } from 'vitest';
import { lighthouseTitleIt, lighthouseDetailIt, lighthouseValueIt } from '../lighthouse-it';

describe('audit SEO in italiano', () => {
    it('traduce i titoli noti, lascia gli altri', () => {
        expect(lighthouseTitleIt('Render-blocking requests')).toBe('Richieste che rallentano la comparsa della pagina');
        expect(lighthouseTitleIt('Reduce unused CSS')).toBe('CSS inutilizzato da ridurre');
        expect(lighthouseTitleIt('Qualcosa di mai visto')).toBe('Qualcosa di mai visto');
    });
    it('dettagli e valori', () => {
        expect(lighthouseDetailIt('Est savings of 900 ms')).toBe('Risparmio stimato: 900 ms');
        expect(lighthouseDetailIt('Est savings of 112 KiB')).toBe('Risparmio stimato: 112 KiB');
        expect(lighthouseDetailIt(undefined)).toBeUndefined();
        expect(lighthouseValueIt('Root document took 320 ms')).toBe('320 ms');
        expect(lighthouseValueIt('6.2 s')).toBe('6.2 s');
    });
});
