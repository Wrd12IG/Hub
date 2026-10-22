import { describe, it, expect } from 'vitest';
import { suggestProductionTypes, proposeProduction, collectTaskMedia, mergeMedia, channelsMissingMedia, linkedTaskIds } from '../content-production';

const base: any = { facebook: false, instagram: false, linkedin: false, tiktok: false, youtube: false, igStories: false };
const att = (url: string, o: any = {}) => ({ url, filename: url.split('/').pop() || 'f', date: '2026-10-22', ...o });

describe('suggestProductionTypes', () => {
    it('reel e video → video', () => { expect(suggestProductionTypes({ ...base, format: 'Reel' })).toContain('video'); expect(suggestProductionTypes({ ...base, format: 'Post', tiktok: true })).toContain('video'); });
    it('post, carosello, storia → grafica', () => { for (const f of ['Post Singolo', 'Carosello', 'Storia']) expect(suggestProductionTypes({ ...base, format: f })).toEqual(['graphic']); });
    it('formato sconosciuto → grafica come minimo', () => expect(suggestProductionTypes({ ...base, format: '' })).toEqual(['graphic']));
});

describe('proposeProduction', () => {
    it('scadenze all\'indietro, il video prima della grafica', () => {
        const p = proposeProduction({ topic: 'Open day', publicationDate: '2026-11-20' }, ['graphic', 'video'], '2026-10-22')!;
        expect(p.map((x) => x.type)).toEqual(['graphic', 'video']);
        expect(p[0].dueDate > p[1].dueDate).toBe(true);
        expect(p[0].title).toBe('Grafica: Open day');
    });
    it('data passata o mancante → null', () => { expect(proposeProduction({ topic: 't', publicationDate: '2026-10-01' }, ['graphic'], '2026-10-22')).toBeNull(); expect(proposeProduction({ topic: 't' }, ['graphic'], '2026-10-22')).toBeNull(); });
    it('pubblicazione vicina: scadenze portate a oggi, in ritardo', () => expect(proposeProduction({ topic: 't', publicationDate: '2026-10-23' }, ['video'], '2026-10-22')![0]).toMatchObject({ dueDate: '2026-10-22', late: true }));
});

describe('collectTaskMedia / mergeMedia', () => {
    it('raccoglie immagini e video dai task, senza doppioni, con il task di origine', () => {
        const m = collectTaskMedia([
            { title: 'Grafica', attachments: [att('https://x/a.jpg'), att('https://x/brief.pdf')] },
            { title: 'Video', attachments: [att('https://x/v.mp4'), att('https://x/a.jpg')] },
        ] as any);
        expect(m.map((x) => [x.kind, x.taskTitle])).toEqual([['image', 'Grafica'], ['video', 'Video']]);
    });
    it('le immagini si accodano senza doppioni, il video nuovo sostituisce', () => {
        expect(mergeMedia({ imageUrls: ['https://x/a.jpg'], videoUrl: '' }, { images: ['https://x/a.jpg', 'https://x/b.jpg'], video: 'https://x/v.mp4' }))
            .toEqual({ imageUrls: ['https://x/a.jpg', 'https://x/b.jpg'], videoUrl: 'https://x/v.mp4' });
        expect(mergeMedia({ imageUrls: [], videoUrl: 'https://x/old.mp4' }, { images: [] }).videoUrl).toBe('https://x/old.mp4');
    });
});

describe('channelsMissingMedia / linkedTaskIds', () => {
    it('Instagram senza media è segnalato, con media no', () => {
        expect(channelsMissingMedia({ instagram: true, igStories: true })).toEqual(['Instagram', 'Storie Instagram']);
        expect(channelsMissingMedia({ instagram: true, imageUrls: ['https://x/a.jpg'] })).toEqual([]);
        expect(channelsMissingMedia({})).toEqual([]);
    });
    it('task collegati: elenco più campo singolo, senza doppioni', () => expect(linkedTaskIds({ taskId: 'a', taskIds: ['b', 'a'] })).toEqual(['b', 'a']));
});
