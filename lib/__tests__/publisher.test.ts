import { describe, it, expect } from 'vitest';
import { requestedChannels, dueState, scheduledInstant, isDue, planChannel, extractPostRef, allAutomatedPublished } from '../publisher';
import type { EditorialContent } from '../data';

const base = (o: Partial<EditorialContent> = {}): EditorialContent => ({
    id: 'c1', topic: 't', clientId: 'cl', format: 'Post', status: 'Approvato',
    facebook: false, instagram: false, linkedin: false, tiktok: false, youtube: false, gbp: false, ...o,
});
const accounts = { windsorAccounts: { instagram: 'ig1', facebook_page: 'fb1', linkedin_organic: 'li1', gbp: ['g1', 'g2'] } };

describe('scheduledInstant', () => {
    it('solo data in inverno: 09:00 di Roma = 08:00 UTC', () => {
        expect(scheduledInstant('2026-12-10')!.toISOString()).toBe('2026-12-10T08:00:00.000Z');
    });
    it('solo data in estate: 09:00 di Roma = 07:00 UTC', () => {
        expect(scheduledInstant('2026-07-10')!.toISOString()).toBe('2026-07-10T07:00:00.000Z');
    });
    it('data con orario presa com\'è', () => {
        expect(scheduledInstant('2026-07-10T12:30:00.000Z')!.toISOString()).toBe('2026-07-10T12:30:00.000Z');
    });
    it('vuota o illeggibile → null', () => {
        expect(scheduledInstant(undefined)).toBeNull();
        expect(scheduledInstant('boh')).toBeNull();
    });
});

describe('isDue', () => {
    const now = new Date('2026-12-10T08:30:00.000Z');
    it('approvato e scaduto', () => expect(isDue({ status: 'Approvato', publicationDate: '2026-12-10' }, now)).toBe(true));
    it('prima delle 9 di Roma non esce', () => expect(isDue({ status: 'Approvato', publicationDate: '2026-12-10' }, new Date('2026-12-10T07:59:00Z'))).toBe(false));
    it('bozza non esce mai', () => expect(isDue({ status: 'Bozza', publicationDate: '2026-12-01' }, now)).toBe(false));
    it('senza data non esce', () => expect(isDue({ status: 'Approvato' }, now)).toBe(false));
});

describe('planChannel', () => {
    it('instagram: una immagine → image_post', () => {
        const r = planChannel(base({ instagram: true, copy: 'ciao', imageUrls: ['https://x/a.jpg'] }), 'instagram', accounts);
        expect(r).toMatchObject({ actions: [{ action: 'create_image_post', accountId: 'ig1', connector: 'instagram' }] });
    });
    it('instagram: più immagini → carosello; video → reel', () => {
        expect(planChannel(base({ imageUrls: ['https://x/a.jpg', 'https://x/b.jpg'] }), 'instagram', accounts)).toMatchObject({ actions: [{ action: 'create_carousel_post' }] });
        expect(planChannel(base({ videoUrl: 'https://x/v.mp4' }), 'instagram', accounts)).toMatchObject({ actions: [{ action: 'create_video_post' }] });
    });
    it('instagram senza media → errore', () => expect(planChannel(base({ copy: 'solo testo' }), 'instagram', accounts)).toHaveProperty('error'));
    it('url non https ignorati', () => expect(planChannel(base({ imageUrls: ['http://x/a.jpg'] }), 'instagram', accounts)).toHaveProperty('error'));
    it('storia senza caption', () => {
        const r = planChannel(base({ imageUrls: ['https://x/a.jpg'], copy: 'x' }), 'igStories', accounts) as any;
        expect(r.actions[0].params).toEqual({ image_url: 'https://x/a.jpg' });
    });
    it('facebook solo testo → create_post', () => expect(planChannel(base({ copy: 'ciao' }), 'facebook', accounts)).toMatchObject({ actions: [{ connector: 'facebook_organic', action: 'create_post' }] }));
    it('gbp: un\'azione per sede', () => {
        const r = planChannel(base({ copy: 'ciao' }), 'gbp', accounts) as any;
        expect(r.actions.map((a: any) => a.accountId)).toEqual(['g1', 'g2']);
    });
    it('account non collegato → errore', () => expect(planChannel(base({ copy: 'x' }), 'linkedin', { windsorAccounts: {} })).toHaveProperty('error'));
    it('tiktok non automatizzato', () => expect(planChannel(base({ copy: 'x' }), 'tiktok', accounts)).toHaveProperty('error'));
    it('il testo lungo viene tagliato al limite', () => {
        const r = planChannel(base({ copy: 'a'.repeat(5000), imageUrls: ['https://x/a.jpg'] }), 'instagram', accounts) as any;
        expect(r.actions[0].params.caption.length).toBe(2200);
    });
});

describe('extractPostRef / allAutomatedPublished', () => {
    it('trova id e permalink annidati', () => {
        expect(extractPostRef({ result: { id: 123, permalink: 'https://instagram.com/p/x' } })).toEqual({ postId: '123', postUrl: 'https://instagram.com/p/x' });
    });
    it('risposta vuota', () => expect(extractPostRef(null)).toEqual({}));
    it('tiktok non blocca, ma serve almeno un canale automatizzato', () => {
        const c = { publishResults: { instagram: { status: 'published' as const } } };
        expect(allAutomatedPublished(c, ['instagram', 'tiktok'])).toBe(true);
        expect(allAutomatedPublished({ publishResults: {} }, ['tiktok'])).toBe(false);
        expect(allAutomatedPublished({ publishResults: {} }, ['instagram'])).toBe(false);
    });
});

describe('arretrato', () => {
    const now = new Date('2026-12-10T08:30:00.000Z');
    it('scaduto da meno di 3 giorni esce', () => expect(dueState({ status: 'Approvato', publicationDate: '2026-12-08' }, now)).toBe('due'));
    it('scaduto da mesi non esce da solo', () => expect(dueState({ status: 'Approvato', publicationDate: '2026-06-23' }, now)).toBe('too-late'));
    it('futuro non ancora', () => expect(dueState({ status: 'Approvato', publicationDate: '2026-12-20' }, now)).toBe('not-yet'));
});

describe('copertina del video', () => {
    it('Instagram: la copertina https va come cover_url', () => {
        const r = planChannel(base({ videoUrl: 'https://x/v.mp4', coverUrl: 'https://x/c.jpg' }), 'instagram', accounts) as any;
        expect(r.actions[0].params).toMatchObject({ video_url: 'https://x/v.mp4', cover_url: 'https://x/c.jpg' });
        expect(r.actions[0].params).not.toHaveProperty('thumb_offset');
    });
    it('senza copertina (o non https) il parametro non c\'è', () => {
        const a = planChannel(base({ videoUrl: 'https://x/v.mp4' }), 'instagram', accounts) as any;
        const b = planChannel(base({ videoUrl: 'https://x/v.mp4', coverUrl: 'http://x/c.jpg' }), 'instagram', accounts) as any;
        expect(a.actions[0].params).not.toHaveProperty('cover_url');
        expect(b.actions[0].params).not.toHaveProperty('cover_url');
    });
});

describe('menzioni, hashtag e storie Facebook', () => {
    it('Instagram: la didascalia porta @menzioni e #hashtag', () => {
        const r = planChannel(base({ copy: 'Ciao', tags: 'estate', mentions: 'toyota', imageUrls: ['https://x/a.jpg'] }), 'instagram', accounts) as any;
        expect(r.actions[0].params.caption).toBe('Ciao\n\n@toyota\n#estate');
    });
    it('le storie Facebook non sono automatizzate', () => {
        expect(planChannel(base({ fbStories: true, imageUrls: ['https://x/a.jpg'] }), 'fbStories', accounts)).toHaveProperty('error');
    });
    it('le storie Facebook risultano tra i canali richiesti ma non bloccano gli altri', () => {
        expect(requestedChannels(base({ fbStories: true, instagram: true }))).toEqual(['instagram', 'fbStories']);
    });
});

describe('storie con più slide', () => {
    it('ogni immagine è una storia, in ordine, con chiavi diverse', () => {
        const r = planChannel(base({ igStories: true, imageUrls: ['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg'] }), 'igStories', accounts) as any;
        expect(r.actions.map((a: any) => a.params.image_url)).toEqual(['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg']);
        expect(new Set(r.actions.map((a: any) => a.key)).size).toBe(3);
        expect(r.actions.every((a: any) => a.action === 'create_story' && a.accountId === 'ig1')).toBe(true);
    });
    it('al massimo 10 storie', () => {
        const urls = Array.from({ length: 14 }, (_, i) => `https://x/${i}.jpg`);
        expect((planChannel(base({ imageUrls: urls }), 'igStories', accounts) as any).actions).toHaveLength(10);
    });
    it('una sola immagine: una sola storia, come prima', () => {
        const r = planChannel(base({ imageUrls: ['https://x/a.jpg'] }), 'igStories', accounts) as any;
        expect(r.actions).toHaveLength(1);
        expect(r.actions[0].params).toEqual({ image_url: 'https://x/a.jpg' });
    });
    it('il video resta una sola storia', () => {
        const r = planChannel(base({ videoUrl: 'https://x/v.mp4', imageUrls: ['https://x/a.jpg'] }), 'igStories', accounts) as any;
        expect(r.actions).toHaveLength(1);
        expect(r.actions[0].params).toEqual({ video_url: 'https://x/v.mp4' });
    });
    it('GBP: le sedi restano distinte dall\'account', () => {
        const r = planChannel(base({ copy: 'ciao' }), 'gbp', accounts) as any;
        expect(r.actions.map((a: any) => a.key ?? a.accountId)).toEqual(['g1', 'g2']);
    });
});

describe('storie miste: video per le slide animate, immagini per le altre', () => {
    const media = [
        { url: 'https://x/1.jpg', kind: 'image' as const },
        { url: 'https://x/2.mp4', kind: 'video' as const },
        { url: 'https://x/3.jpg', kind: 'image' as const },
    ];
    it('pubblica in ordine, con video_url per i video e image_url per le immagini, e chiavi diverse', () => {
        const r = planChannel(base({ igStories: true, storyMedia: media, imageUrls: ['https://x/p1.jpg', 'https://x/p2.jpg', 'https://x/p3.jpg'] }), 'igStories', accounts) as any;
        expect(r.actions.map((a: any) => a.params)).toEqual([{ image_url: 'https://x/1.jpg' }, { video_url: 'https://x/2.mp4' }, { image_url: 'https://x/3.jpg' }]);
        expect(new Set(r.actions.map((a: any) => a.key)).size).toBe(3);
        expect(r.actions.every((a: any) => a.action === 'create_story' && a.accountId === 'ig1')).toBe(true);
    });
    it('storyMedia ha la precedenza su imageUrls; vuoto = si usano le immagini come prima', () => {
        const withMedia = planChannel(base({ storyMedia: media, imageUrls: ['https://x/p1.jpg'] }), 'igStories', accounts) as any;
        expect(withMedia.actions).toHaveLength(3);
        const empty = planChannel(base({ storyMedia: [], imageUrls: ['https://x/p1.jpg'] }), 'igStories', accounts) as any;
        expect(empty.actions.map((a: any) => a.params)).toEqual([{ image_url: 'https://x/p1.jpg' }]);
    });
    it('scarta indirizzi non https e tipi sconosciuti, al massimo 10', () => {
        const dirty: any[] = [{ url: 'http://x/a.mp4', kind: 'video' }, { url: 'https://x/b.mp4', kind: 'gif' }, null, { url: 'https://x/ok.mp4', kind: 'video' }];
        const r = planChannel(base({ storyMedia: dirty }), 'igStories', accounts) as any;
        expect(r.actions.map((a: any) => a.params)).toEqual([{ video_url: 'https://x/ok.mp4' }]);
        const many = Array.from({ length: 14 }, (_, i) => ({ url: `https://x/${i}.mp4`, kind: 'video' as const }));
        expect((planChannel(base({ storyMedia: many }), 'igStories', accounts) as any).actions).toHaveLength(10);
    });
    it('Instagram post e Facebook non cambiano', () => {
        const ig = planChannel(base({ storyMedia: media, imageUrls: ['https://x/a.jpg'], copy: 'x' }), 'instagram', accounts) as any;
        expect(ig.actions[0].action).toBe('create_image_post');
    });
});
