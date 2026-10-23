import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { supported: true, failMp4For: new Set<string>(), notes: [] as string[], uploadFails: false };
const calls: { jpeg: string[]; mp4: string[]; uploads: { name: string; type: string; folder: string }[] } = { jpeg: [], mp4: [], uploads: [] };

vi.mock('../export', () => ({ renderSlideToJpeg: async (s: any) => { calls.jpeg.push(s.id); return new Blob(['jpg'], { type: 'image/jpeg' }); } }));
vi.mock('../export-video', () => ({
    videoExportSupported: () => state.supported,
    renderSlideToMp4: async (s: any, o: any) => {
        calls.mp4.push(s.id);
        o?.onProgress?.(1, 10, 'Creo il video');
        if (state.failMp4For.has(s.id)) throw new Error('Il video non si carica.');
        return { blob: new Blob(['mp4'], { type: 'video/mp4' }), durationSeconds: 6, hasAudio: false, notes: state.notes };
    },
}));

import { buildStoryFiles } from '../save-pipeline';
import { makeImage, makeSlide, makeText } from '@/lib/story-editor/factory';

const gif = () => makeImage('https://media2.giphy.com/media/a/giphy.gif', 300, 300, { source: 'gif' });
const upload = async (files: File[], folder: string) => {
    if (state.uploadFails) throw new Error('rete');
    return files.map((f) => { calls.uploads.push({ name: f.name, type: f.type, folder }); return `https://cdn/${f.name}`; });
};

describe('buildStoryFiles', () => {
    beforeEach(() => { state.supported = true; state.failMp4For = new Set(); state.notes = []; state.uploadFails = false; calls.jpeg = []; calls.mp4 = []; calls.uploads = []; });

    it('solo slide ferme: nessun video, tutte immagini nell\'ordine', async () => {
        const a = makeSlide({ layers: [makeText({ text: 'a' })] }), b = makeSlide({});
        const r = await buildStoryFiles({ design: { version: 2, slides: [a, b] }, upload, onProgress: () => {} });
        expect(calls.mp4).toEqual([]);
        expect(r.storyMedia.map((m) => m.kind)).toEqual(['image', 'image']);
        expect(r.storyMedia.map((m) => m.url)).toEqual(r.imageUrls);
        expect(r.warnings).toEqual([]);
    });

    it('una slide con GIF esce come MP4 e le altre restano JPEG, nell\'ordine delle slide', async () => {
        const a = makeSlide({}), b = makeSlide({ layers: [gif()] }), c = makeSlide({});
        const r = await buildStoryFiles({ design: { version: 2, slides: [a, b, c] }, upload, onProgress: () => {} });
        expect(calls.mp4).toEqual([b.id]);
        expect(r.storyMedia.map((m) => m.kind)).toEqual(['image', 'video', 'image']);
        expect(r.storyMedia[1].url).toMatch(/storia-\d+-2\.mp4$/);
        expect(r.imageUrls).toHaveLength(3); // i JPEG restano per l'anteprima
        expect(calls.uploads.find((u) => u.name.endsWith('.mp4'))?.type).toBe('video/mp4');
    });

    it('un video di sfondo fa uscire la slide come MP4', async () => {
        const v = makeSlide({ background: { type: 'video', url: 'https://x/v.mp4', trimStart: 0, trimEnd: 0 } });
        const r = await buildStoryFiles({ design: { version: 2, slides: [v] }, upload, onProgress: () => {} });
        expect(r.storyMedia).toEqual([{ url: r.videoBySlide[v.id], kind: 'video' }]);
    });

    it('se un video non riesce: quella slide ricade sul JPEG, le altre no, e c\'è un avviso con il numero della slide', async () => {
        const a = makeSlide({ layers: [gif()] }), b = makeSlide({ layers: [gif()] });
        state.failMp4For.add(a.id);
        const r = await buildStoryFiles({ design: { version: 2, slides: [a, b] }, upload, onProgress: () => {} });
        expect(r.storyMedia.map((m) => m.kind)).toEqual(['image', 'video']);
        expect(r.warnings).toHaveLength(1);
        expect(r.warnings[0]).toContain('Slide 1');
        expect(r.warnings[0]).toContain('immagine ferma');
    });

    it('browser senza esportazione video: tutto JPEG e un solo avviso, senza tentare gli MP4', async () => {
        state.supported = false;
        const a = makeSlide({ layers: [gif()] }), b = makeSlide({ layers: [gif()] });
        const r = await buildStoryFiles({ design: { version: 2, slides: [a, b] }, upload, onProgress: () => {} });
        expect(calls.mp4).toEqual([]);
        expect(r.storyMedia.every((m) => m.kind === 'image')).toBe(true);
        expect(r.warnings).toHaveLength(1);
    });

    it('le note del video (es. «senza audio») arrivano come avvisi con la slide', async () => {
        state.notes = ['Il video non ha audio leggibile: la storia esce senza suono.'];
        const r = await buildStoryFiles({ design: { version: 2, slides: [makeSlide({}), makeSlide({ layers: [gif()] })] }, upload, onProgress: () => {} });
        expect(r.warnings).toEqual(['Slide 2: Il video non ha audio leggibile: la storia esce senza suono.']);
    });

    it('se il caricamento dei JPEG fallisce, il salvataggio fallisce (non si salva a metà)', async () => {
        state.uploadFails = true;
        await expect(buildStoryFiles({ design: { version: 2, slides: [makeSlide({})] }, upload, onProgress: () => {} })).rejects.toThrow('rete');
    });

    it('riporta l\'avanzamento', async () => {
        const msgs: string[] = [];
        await buildStoryFiles({ design: { version: 2, slides: [makeSlide({ layers: [gif()] })] }, upload, onProgress: (m) => msgs.push(m) });
        expect(msgs.some((m) => m.startsWith('Preparo le immagini 1/1'))).toBe(true);
        expect(msgs.some((m) => m.includes('Video 1/1'))).toBe(true);
    });
});
