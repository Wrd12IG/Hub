import { describe, it, expect } from 'vitest';
import { splitTaskMedia, suggestFormat, canInsertInPed } from '../task-to-content';

const att = (o: any) => ({ date: '2026-10-22', filename: 'f', url: 'https://x/f', ...o });

describe('splitTaskMedia', () => {
    it('separa immagini e video, per tipo o per estensione', () => {
        const r = splitTaskMedia([
            att({ url: 'https://x/a.jpg' }), att({ url: 'https://x/b', type: 'image/png' }),
            att({ url: 'https://x/c.mp4' }), att({ url: 'https://x/d.pdf', filename: 'brief.pdf' }),
        ]);
        expect(r.images).toHaveLength(2);
        expect(r.videos).toHaveLength(1);
    });
    it('scarta gli url non https', () => expect(splitTaskMedia([att({ url: 'http://x/a.jpg' })]).images).toHaveLength(0));
    it('nessun allegato', () => expect(splitTaskMedia(undefined)).toEqual({ images: [], videos: [] }));
});

describe('suggestFormat', () => {
    it('video → Reel', () => expect(suggestFormat(3, true)).toBe('Reel'));
    it('più immagini → Carosello', () => expect(suggestFormat(2, false)).toBe('Carosello'));
    it('una o nessuna → Post Singolo', () => { expect(suggestFormat(1, false)).toBe('Post Singolo'); expect(suggestFormat(0, false)).toBe('Post Singolo'); });
});

describe('canInsertInPed', () => {
    it('libero: sì, qualunque sia lo stato del task', () => expect(canInsertInPed({}).ok).toBe(true));
    it('già collegato: no', () => expect(canInsertInPed({ editorialContentId: 'c1' }).ok).toBe(false));
    it('nessun task: no', () => expect(canInsertInPed(null).ok).toBe(false));
});
