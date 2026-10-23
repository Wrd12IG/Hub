import { describe, it, expect } from 'vitest';
import { isVisibleToClient, toClientPedItem, sortForClient } from '../client-ped';
import type { EditorialContent } from '../data';

const c = (o: Partial<EditorialContent> = {}): EditorialContent => ({
    id: 'c1', topic: 'Open day', clientId: 'cl', format: 'Post', status: 'Approvato',
    facebook: true, instagram: true, linkedin: false, tiktok: false, youtube: false, gbp: false, ...o,
});

describe('isVisibleToClient', () => {
    it('le bozze del team no', () => expect(isVisibleToClient({ status: 'Bozza' })).toBe(false));
    it('una bozza tornata per le sue modifiche sì', () => expect(isVisibleToClient({ status: 'Bozza', approval: { status: 'changes', requestedAt: 'x' } })).toBe(true));
    it('inviato, approvato, pubblicato sì', () => {
        for (const status of ['In Approvazione Cliente', 'Approvato', 'Pubblicato']) expect(isVisibleToClient({ status })).toBe(true);
    });
});

describe('toClientPedItem', () => {
    it('espone solo i campi previsti', () => {
        const item = toClientPedItem(c({ taskId: 't', projectId: 'p', customFields: { a: 'b' }, publishResults: { instagram: { status: 'failed', error: 'segreto interno' } } }));
        expect(Object.keys(item).sort()).toEqual(['approval', 'awaitingClient', 'channels', 'copy', 'coverUrl', 'format', 'hashtags', 'id', 'imageUrls', 'mentions', 'publicationDate', 'published', 'status', 'storyLink', 'storyMedia', 'topic', 'videoUrl']);
        expect(JSON.stringify(item)).not.toContain('segreto interno');
    });
    it('storyMedia: solo https e solo i tipi noti, nell\'ordine', () => {
        const out = toClientPedItem(c({ storyMedia: [{ url: 'https://x/1.jpg', kind: 'image' }, { url: 'http://x/2.mp4', kind: 'video' }, { url: 'https://x/3.mp4', kind: 'video' }, { url: 'https://x/4', kind: 'gif' } as any] })).storyMedia;
        expect(out).toEqual([{ url: 'https://x/1.jpg', kind: 'image' }, { url: 'https://x/3.mp4', kind: 'video' }]);
        expect(toClientPedItem(c({})).storyMedia).toEqual([]);
    });
    it('solo media https', () => expect(toClientPedItem(c({ imageUrls: ['https://x/a.jpg', 'http://x/b.jpg'], videoUrl: 'http://x/v.mp4' })).imageUrls).toEqual(['https://x/a.jpg']));
    it('da approvare', () => expect(toClientPedItem(c({ status: 'In Approvazione Cliente', approval: { status: 'requested', requestedAt: 'x' } })).awaitingClient).toBe(true));
    it('link dei post usciti, mai errori', () => {
        const item = toClientPedItem(c({ publishResults: { instagram: { status: 'published', postUrl: 'https://instagram.com/p/x' }, facebook: { status: 'failed', error: 'x' } } }));
        expect(item.published).toEqual([{ channel: 'Instagram', url: 'https://instagram.com/p/x' }]);
    });
});

describe('sortForClient', () => {
    it('prima da approvare, poi per data', () => {
        const items = [
            toClientPedItem(c({ id: 'a', publicationDate: '2026-11-01' })),
            toClientPedItem(c({ id: 'b', publicationDate: '2026-12-01', status: 'In Approvazione Cliente', approval: { status: 'requested', requestedAt: 'x' } })),
            toClientPedItem(c({ id: 'd', publicationDate: '2026-10-01' })),
        ];
        expect(sortForClient(items).map((i) => i.id)).toEqual(['b', 'd', 'a']);
    });
});
