import { describe, it, expect } from 'vitest';
import { buildStoryMedia, cycleSeconds, frameCount, gifFrameIndexAt, isAnimatedLayer, isGifUrl, isVideoSlide, normalizeDelays, slideDurationSeconds, trimRange } from '../animation';
import { makeImage, makeSlide, makeText } from '../factory';

const gifLayer = () => makeImage('https://media2.giphy.com/media/abc/giphy.gif', 400, 400, { source: 'gif' });

describe('quali slide sono video', () => {
    it('riconosce le GIF dall\'indirizzo, anche con query e percorsi di Firebase', () => {
        expect(isGifUrl('https://media2.giphy.com/media/abc/200w.gif')).toBe(true);
        expect(isGifUrl('https://media2.giphy.com/media/abc/giphy.GIF?cid=1')).toBe(true);
        expect(isGifUrl('https://firebasestorage.googleapis.com/v0/b/x/o/editorial-plan%2Fstory-media%2Fanim.gif?alt=media&token=1')).toBe(true);
        expect(isGifUrl('https://x.com/foto.jpg')).toBe(false);
    });
    it('una slide con testo e foto resta immagine', () => {
        const s = makeSlide({ layers: [makeText({ text: 'ciao' }), makeImage('https://x.com/a.jpg', 100, 100)] });
        expect(isVideoSlide(s)).toBe(false);
    });
    it('una GIF (anche solo dal campo source) rende la slide un video; una GIF nascosta no', () => {
        expect(isVideoSlide(makeSlide({ layers: [gifLayer()] }))).toBe(true);
        expect(isVideoSlide(makeSlide({ layers: [makeImage('https://x.com/a.png', 10, 10, { source: 'gif' })] }))).toBe(true);
        expect(isVideoSlide(makeSlide({ layers: [{ ...gifLayer(), hidden: true }] }))).toBe(false);
    });
    it('il video di sfondo rende la slide un video', () => {
        const s = makeSlide({ background: { type: 'video', url: 'https://x/v.mp4', trimStart: 0, trimEnd: 0 } });
        expect(isVideoSlide(s)).toBe(true);
        expect(isAnimatedLayer(makeImage('https://x.com/a.jpg', 10, 10))).toBe(false);
    });
});

describe('durata', () => {
    const vid = (trimStart: number, trimEnd: number) => makeSlide({ background: { type: 'video', url: 'https://x/v.mp4', trimStart, trimEnd } });
    it('taglio: usa la parte scelta, fra 3 e 60 secondi', () => {
        expect(slideDurationSeconds(vid(2, 12), { videoDuration: 30 })).toBe(10);
        expect(slideDurationSeconds(vid(0, 0), { videoDuration: 90 })).toBe(60);
        expect(slideDurationSeconds(vid(0, 1.5), { videoDuration: 30 })).toBe(3);
    });
    it('trimRange: fine 0 o oltre la durata = fino alla fine; inizio non oltre la fine', () => {
        expect(trimRange(0, 0, 20)).toEqual({ start: 0, end: 20 });
        expect(trimRange(5, 99, 20)).toEqual({ start: 5, end: 20 });
        expect(trimRange(30, 40, 20).start).toBeLessThan(20);
        expect(trimRange(5, 3, 20)).toEqual({ start: 5, end: 20 });
    });
    it('solo GIF: ripete il ciclo fino a ~6 s, mai oltre 15 s, mai sotto 3 s', () => {
        const s = makeSlide({ layers: [gifLayer()] });
        expect(slideDurationSeconds(s, { gifCycles: [1.5] })).toBe(6);
        expect(slideDurationSeconds(s, { gifCycles: [4] })).toBe(8);
        expect(slideDurationSeconds(s, { gifCycles: [40] })).toBe(15);
        expect(slideDurationSeconds(s, { gifCycles: [0.5] })).toBe(6);
        expect(slideDurationSeconds(s, {})).toBe(6);
    });
    it('numero di fotogrammi', () => {
        expect(frameCount(6)).toBe(180);
        expect(frameCount(0)).toBe(1);
    });
});

describe('fotogramma della GIF', () => {
    const delays = [100, 100, 200]; // ciclo 0,4 s
    it('sceglie il fotogramma giusto e riparte da capo', () => {
        expect(gifFrameIndexAt(delays, 0)).toBe(0);
        expect(gifFrameIndexAt(delays, 0.05)).toBe(0);
        expect(gifFrameIndexAt(delays, 0.1)).toBe(1);
        expect(gifFrameIndexAt(delays, 0.25)).toBe(2);
        expect(gifFrameIndexAt(delays, 0.4)).toBe(0);
        expect(gifFrameIndexAt(delays, 0.55)).toBe(1);
        expect(gifFrameIndexAt(delays, 100.05)).toBe(0);
    });
    it('ritardi assenti o troppo brevi valgono 100 ms', () => {
        expect(normalizeDelays([0, 10, 50])).toEqual([100, 100, 50]);
        expect(cycleSeconds([0, 0])).toBeCloseTo(0.2);
        expect(gifFrameIndexAt([], 3)).toBe(0);
    });
});

describe('buildStoryMedia', () => {
    it('video per le slide animate, JPEG per le altre, nell\'ordine delle slide', () => {
        const a = makeSlide({}), b = makeSlide({ layers: [gifLayer()] }), c = makeSlide({});
        const out = buildStoryMedia([a, b, c], ['a.jpg', 'b.jpg', 'c.jpg'], { [b.id]: 'b.mp4' });
        expect(out).toEqual([{ url: 'a.jpg', kind: 'image' }, { url: 'b.mp4', kind: 'video' }, { url: 'c.jpg', kind: 'image' }]);
    });
    it('se il video non c\'è ricade sul JPEG', () => {
        const b = makeSlide({ layers: [gifLayer()] });
        expect(buildStoryMedia([b], ['b.jpg'], {})).toEqual([{ url: 'b.jpg', kind: 'image' }]);
    });
});
