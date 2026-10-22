import { describe, it, expect } from 'vitest';
import { computeSnap } from '../snap';
import { STORY_TEMPLATES, DEFAULT_PALETTE, findTemplate } from '../templates';
import { parseStoryData, serializeDesign } from '../serialize';
import { cloneSlide, emptyDesign, makeSlide, makeText } from '../factory';
import { isProxyable, viaProxy } from '../proxy';
import { STORY_H, STORY_W } from '../types';

describe('computeSnap', () => {
    it('si attacca al centro della tela', () => {
        const r = computeSnap({ x: STORY_W / 2 - 300 + 6, y: 400, width: 600, height: 200 }, []);
        expect(r.dx).toBe(-6);
        expect(r.vertical).toEqual([STORY_W / 2]);
    });
    it('si attacca al bordo di un altro livello', () => {
        const r = computeSnap({ x: 205, y: 800, width: 100, height: 100 }, [{ x: 200, y: 100, width: 300, height: 100 }]);
        expect(r.dx).toBe(-5);
    });
    it('oltre la soglia non si muove', () => {
        const r = computeSnap({ x: 300, y: 500, width: 100, height: 100 }, []);
        expect(r).toMatchObject({ dx: 0, dy: 0, vertical: [], horizontal: [] });
    });
    it('si attacca al centro verticale', () => {
        const r = computeSnap({ x: 100, y: STORY_H / 2 - 50 + 9, width: 100, height: 100 }, []);
        expect(r.dy).toBe(-9);
    });
});

describe('modelli', () => {
    it('ce ne sono e sono tutti validi', () => {
        expect(STORY_TEMPLATES.length).toBeGreaterThanOrEqual(8);
        for (const t of STORY_TEMPLATES) {
            const s = t.build(DEFAULT_PALETTE);
            expect(s.layers.length).toBeGreaterThan(0);
            expect(new Set(s.layers.map((l) => l.id)).size).toBe(s.layers.length);
            for (const l of s.layers) expect(Number.isFinite(l.x) && Number.isFinite(l.y)).toBe(true);
        }
        expect(new Set(STORY_TEMPLATES.map((t) => t.id)).size).toBe(STORY_TEMPLATES.length);
    });
    it('usano i colori del cliente', () => {
        const s = findTemplate('promo')!.build({ ...DEFAULT_PALETTE, primary: '#123456' });
        expect(JSON.stringify(s.background)).toContain('#123456');
    });
    it('applicare due volte non ripete gli id', () => {
        const a = cloneSlide(findTemplate('promo')!.build(DEFAULT_PALETTE));
        const b = cloneSlide(findTemplate('promo')!.build(DEFAULT_PALETTE));
        const ids = [...a.layers, ...b.layers].map((l) => l.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('serializzazione', () => {
    it('andata e ritorno', () => {
        const d = emptyDesign();
        d.slides[0].layers.push(makeText({ text: 'Ciao' }));
        const back = parseStoryData(serializeDesign(d))!;
        expect(back.slides[0].layers[0]).toMatchObject({ type: 'text', text: 'Ciao' });
    });
    it('legge le bozze del vecchio editor (tela 360×640) portandole a 1080×1920', () => {
        const old = JSON.stringify([
            { id: 'a', type: 'text', content: 'Vecchio', x: 50, y: 150, rotation: 0, scaleX: 1, scaleY: 1, fontSize: 24, fontWeight: 'bold', fontStyle: 'normal', align: 'center', color: '#fff' },
            { id: 'b', type: 'sticker', content: '🔥', x: 100, y: 200, rotation: 0, scaleX: 1, scaleY: 1, fontSize: 64 },
            { id: 'c', type: 'image', url: 'blob:http://x/1', x: 0, y: 0, width: 360, height: 640, rotation: 0, scaleX: 1, scaleY: 1 },
        ]);
        const d = parseStoryData(old)!;
        expect(d.slides[0].layers).toHaveLength(2); // l'immagine temporanea (blob:) non si può recuperare
        expect(d.slides[0].layers[0]).toMatchObject({ type: 'text', text: 'Vecchio', x: 150, y: 450, fontSize: 72, bold: true });
        expect(d.slides[0].layers[1]).toMatchObject({ type: 'emoji', text: '🔥', fontSize: 192 });
    });
    it('un\'immagine a tutta tela https diventa lo sfondo', () => {
        const d = parseStoryData([{ id: 'c', type: 'image', url: 'https://x/a.jpg', x: 0, y: 0, width: 360, height: 640, rotation: 0, scaleX: 1, scaleY: 1 }])!;
        expect(d.slides[0].background).toMatchObject({ type: 'image', url: 'https://x/a.jpg' });
        expect(d.slides[0].layers).toHaveLength(0);
    });
    it('dati illeggibili → null', () => {
        expect(parseStoryData('non json')).toBeNull();
        expect(parseStoryData({ version: 3, slides: [] })).toBeNull();
        expect(parseStoryData(undefined)).toBeNull();
    });
});

describe('proxy dei media', () => {
    it('solo https e solo domini consentiti', () => {
        expect(isProxyable('https://images.pexels.com/photos/1/a.jpg')).toBe(true);
        expect(isProxyable('https://media1.giphy.com/media/x/giphy.gif')).toBe(true);
        expect(isProxyable('https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media')).toBe(true);
        expect(isProxyable('http://images.pexels.com/a.jpg')).toBe(false);
        expect(isProxyable('https://evil.com/a.jpg')).toBe(false);
        expect(isProxyable('https://images.pexels.com.evil.com/a.jpg')).toBe(false);
        expect(isProxyable('https://user:pass@images.pexels.com/a.jpg')).toBe(false);
        expect(isProxyable('non un url')).toBe(false);
    });
    it('viaProxy lascia stare i percorsi interni e i file locali', () => {
        expect(viaProxy('/images/a.png')).toBe('/images/a.png');
        expect(viaProxy('blob:http://x/1')).toBe('blob:http://x/1');
        expect(viaProxy('https://images.pexels.com/a.jpg')).toContain('/api/stories/media-proxy?url=');
        expect(viaProxy('https://evil.com/a.jpg')).toBe('https://evil.com/a.jpg');
    });
});
