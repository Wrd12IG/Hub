import { describe, it, expect } from 'vitest';
import { collectClientMedia, normalizeGiphy, normalizePexels } from '../stock';

describe('normalizeGiphy', () => {
    const json = {
        data: [
            { id: 'a', title: 'Ciao', images: { original: { url: 'https://media2.giphy.com/media/a/giphy.gif?cid=1', width: '480', height: '270' }, fixed_width: { url: 'https://media2.giphy.com/media/a/200w.gif' } } },
            { id: 'b', title: 'Strana', images: { original: { url: 'https://evil.com/b.gif' }, fixed_width: { url: 'https://evil.com/b.gif' } } },
            { title: 'senza id', images: {} },
        ],
        pagination: { total_count: 100, count: 3, offset: 0 },
    };
    it('tiene solo le GIF su domini consentiti, con misure numeriche', () => {
        const r = normalizeGiphy(json);
        expect(r.items).toHaveLength(1);
        expect(r.items[0]).toMatchObject({ id: 'a', url: 'https://media2.giphy.com/media/a/giphy.gif?cid=1', preview: 'https://media2.giphy.com/media/a/200w.gif', width: 480, height: 270 });
    });
    it('calcola la pagina successiva, e null alla fine', () => {
        expect(normalizeGiphy(json).nextOffset).toBe(3);
        expect(normalizeGiphy({ ...json, pagination: { total_count: 3, count: 3, offset: 0 } }).nextOffset).toBeNull();
    });
    it('risposta vuota o strana non esplode', () => { expect(normalizeGiphy(null).items).toEqual([]); expect(normalizeGiphy({ data: 'no' }).items).toEqual([]); });
});

describe('normalizePexels', () => {
    const json = {
        page: 2, next_page: 'https://api.pexels.com/v1/search?page=3',
        photos: [
            { id: 7, width: 4000, height: 6000, alt: 'Mare', photographer: 'Mario Rossi', src: { large2x: 'https://images.pexels.com/photos/7/large2x.jpg', medium: 'https://images.pexels.com/photos/7/medium.jpg' } },
            { id: 8, src: { large2x: 'http://images.pexels.com/photos/8/x.jpg', medium: 'http://images.pexels.com/photos/8/m.jpg' } },
        ],
    };
    it('foto con autore, solo https consentito', () => {
        const r = normalizePexels(json);
        expect(r.items).toHaveLength(1);
        expect(r.items[0]).toMatchObject({ id: '7', title: 'Mare', credit: 'Mario Rossi', width: 4000, height: 6000 });
    });
    it('pagina successiva dal numero attuale', () => expect(normalizePexels(json).nextPage).toBe(3));
    it('senza pagina successiva → null', () => expect(normalizePexels({ ...json, next_page: undefined }).nextPage).toBeNull());
});

describe('collectClientMedia', () => {
    it('unisce galleria e contenuti, senza doppioni, solo https, i più recenti prima', () => {
        const assets = [{ url: 'https://x/a.jpg', name: 'logo.jpg' }, { downloadUrl: 'https://x/doc.pdf', name: 'brief.pdf' }, { url: 'http://x/old.jpg', name: 'old.jpg' }];
        const contents = [
            { topic: 'Vecchio', updatedAt: '2026-01-01', imageUrls: ['https://x/a.jpg', 'https://x/v1.jpg'] },
            { topic: 'Nuovo', updatedAt: '2026-10-01', imageUrls: ['https://x/n1.jpg'], videoUrl: 'https://x/n.mp4', coverUrl: 'https://x/cover.jpg' },
        ];
        const m = collectClientMedia(assets, contents);
        expect(m.map((x) => x.url)).toEqual(['https://x/a.jpg', 'https://x/n1.jpg', 'https://x/n.mp4', 'https://x/cover.jpg', 'https://x/v1.jpg']);
        expect(m.find((x) => x.url.endsWith('n.mp4'))?.kind).toBe('video');
        expect(m[0].source).toBe('asset');
    });
    it('rispetta il limite', () => expect(collectClientMedia([], [{ imageUrls: Array.from({ length: 300 }, (_, i) => `https://x/${i}.jpg`) }], 50)).toHaveLength(50));
});
