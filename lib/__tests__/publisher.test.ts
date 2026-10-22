import { describe, it, expect } from 'vitest';
import { dueState, scheduledInstant, isDue, planChannel, extractPostRef, allAutomatedPublished } from '../publisher';
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
