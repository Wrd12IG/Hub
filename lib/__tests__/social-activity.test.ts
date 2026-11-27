import { describe, it, expect } from 'vitest';
import { isSocialContentActivity } from '../social-activity';

describe('isSocialContentActivity', () => {
    it('riconosce le attività dei contenuti social', () => {
        for (const a of ['Realizzazione Carosello', 'Realizzazione grafica', 'Montaggio video', 'Stories', 'Modifica video e motion graphics', 'Editing foto'])
            expect(isSocialContentActivity(a)).toBe(true);
    });
    it('lascia stare il resto', () => {
        for (const a of ['Creazione sito web', 'Meta Pixel & CAPI', 'Creazione DEM', 'Coordinamento interno', '', undefined])
            expect(isSocialContentActivity(a)).toBe(false);
    });
});
