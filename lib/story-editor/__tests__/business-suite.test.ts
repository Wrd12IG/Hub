import { describe, it, expect } from 'vitest';
import { businessSuiteUrl, linkStickersOf, needsBusinessSuite, normalizeLink, storyKit, withoutLinkStickers } from '../business-suite';
import { emptyDesign, makeSlide } from '../factory';
import { manualChannelReason, MANUAL_BUSINESS_SUITE, MANUAL_UNSUPPORTED } from '../../publisher';
import { businessSuiteReminders } from '../../publish-alerts';
import { contentFingerprint } from '../../content-approval';
import type { EditorialContent } from '../../data';
import type { StickerLayer, StoryDesign } from '../types';

const sticker = (o: Partial<StickerLayer>): StickerLayer => ({
    id: 's', type: 'sticker', sticker: 'link', text: '', options: [], x: 300, y: 1500, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, ...o,
});
const design = (...layersPerSlide: StickerLayer[][]): StoryDesign => {
    const d = emptyDesign();
    d.slides = layersPerSlide.map((layers) => ({ ...makeSlide(), layers }));
    return d;
};
const base = (o: Partial<EditorialContent> = {}): EditorialContent => ({
    id: 'c1', topic: 't', clientId: 'cl', format: 'Storia', status: 'Approvato',
    facebook: false, instagram: false, linkedin: false, tiktok: false, youtube: false, gbp: false, igStories: true, ...o,
});

describe('normalizeLink', () => {
    it('aggiunge https e accetta indirizzi veri', () => {
        expect(normalizeLink('www.sito.it/offerta')).toBe('https://www.sito.it/offerta');
        expect(normalizeLink('http://a.it')).toBe('http://a.it/');
    });
    it('scarta testi che non sono indirizzi', () => {
        expect(normalizeLink('SCOPRI DI PIÙ')).toBe('');
        expect(normalizeLink('ciao')).toBe('');
        expect(normalizeLink('')).toBe('');
        expect(normalizeLink('javascript:alert(1)')).toBe('');
    });
});

describe('linkStickersOf', () => {
    it('un link per slide, con la zona', () => {
        const r = linkStickersOf(design([], [sticker({ text: 'sito.it', y: 200 })], [sticker({ text: 'altro.it/x', y: 1700 })]));
        expect(r).toEqual([
            { slide: 1, url: 'https://sito.it/', area: 'alto' },
            { slide: 2, url: 'https://altro.it/x', area: 'basso' },
        ]);
    });
    it('sticker con un testo qualsiasi usa il link generale; senza link si ignora', () => {
        expect(linkStickersOf(design([sticker({ text: 'Scopri', y: 900 })]), 'https://x.it')).toEqual([{ slide: 0, url: 'https://x.it/', area: 'centro' }]);
        expect(linkStickersOf(design([sticker({ text: 'Scopri' })]))).toEqual([]);
    });
    it('ignora sticker nascosti e di altro tipo', () => {
        expect(linkStickersOf(design([sticker({ text: 'a.it', hidden: true }), sticker({ sticker: 'hashtag', text: 'b.it' })]))).toEqual([]);
    });
});

describe('withoutLinkStickers', () => {
    it('nasconde solo gli sticker link, senza toccare l\'originale', () => {
        const d = design([sticker({ id: 'l', text: 'a.it' }), sticker({ id: 'h', sticker: 'hashtag', text: 'x' })]);
        const out = withoutLinkStickers(d);
        expect(out.slides[0].layers.find((l) => l.id === 'l')!.hidden).toBe(true);
        expect(out.slides[0].layers.find((l) => l.id === 'h')!.hidden).toBeFalsy();
        expect(d.slides[0].layers[0].hidden).toBeFalsy();
    });
});

describe('storyKit', () => {
    it('usa storyMedia e mette il link sulle slide degli sticker', () => {
        const kit = storyKit({ storyMedia: [{ url: 'https://f/1.jpg', kind: 'image' }, { url: 'https://f/2.mp4', kind: 'video' }], storyLinkStickers: [{ slide: 1, url: 'https://s.it', area: 'basso' }] });
        expect(kit).toEqual([
            { index: 0, url: 'https://f/1.jpg', kind: 'image' },
            { index: 1, url: 'https://f/2.mp4', kind: 'video', link: 'https://s.it/', area: 'basso' },
        ]);
    });
    it('link solo dal PED: va sull\'ultima slide', () => {
        const kit = storyKit({ imageUrls: ['https://f/1.jpg', 'https://f/2.jpg'], storyLink: 'sito.it' });
        expect(kit.map((c) => c.link)).toEqual([undefined, 'https://sito.it/']);
    });
    it('sticker su una slide che non c\'è più: ignorato', () => {
        expect(storyKit({ imageUrls: ['https://f/1.jpg'], storyLinkStickers: [{ slide: 4, url: 'https://s.it' }] }).some((c) => c.link)).toBe(false);
    });
});

describe('needsBusinessSuite e manualChannelReason', () => {
    it('storia Instagram con link → Business Suite', () => {
        const c = base({ imageUrls: ['https://f/1.jpg'], storyLink: 'https://sito.it' });
        expect(needsBusinessSuite(c)).toBe(true);
        expect(manualChannelReason(c, 'igStories')).toBe(MANUAL_BUSINESS_SUITE);
    });
    it('storia senza link: esce da sola come prima', () => {
        const c = base({ imageUrls: ['https://f/1.jpg'] });
        expect(needsBusinessSuite(c)).toBe(false);
        expect(manualChannelReason(c, 'igStories')).toBeNull();
    });
    it('il link non tocca gli altri canali', () => {
        const c = base({ imageUrls: ['https://f/1.jpg'], storyLink: 'https://sito.it', instagram: true });
        expect(manualChannelReason(c, 'instagram')).toBeNull();
        expect(manualChannelReason(c, 'tiktok')).toBe(MANUAL_UNSUPPORTED);
    });
    it('storia Instagram non spuntata: niente Business Suite', () => {
        expect(needsBusinessSuite(base({ igStories: false, imageUrls: ['https://f/1.jpg'], storyLink: 'https://sito.it' }))).toBe(false);
    });
});

describe('businessSuiteReminders', () => {
    const now = new Date('2026-11-26T10:00:00Z');
    const approved = (o: Partial<EditorialContent>) => {
        const c = base({ imageUrls: ['https://f/1.jpg'], storyLink: 'https://sito.it', publicationDate: '2026-11-28', ...o });
        return { ...c, approval: { status: 'approved' as const, requestedAt: now.toISOString(), contentHash: contentFingerprint(c) } };
    };
    it('avvisa una storia con link approvata entro una settimana', () => {
        expect(businessSuiteReminders([approved({})], now).map((a) => a.contentId)).toEqual(['c1']);
    });
    it('non avvisa: troppo lontana, già programmata, già avvisata, senza link', () => {
        expect(businessSuiteReminders([approved({ publicationDate: '2026-12-20' })], now)).toEqual([]);
        expect(businessSuiteReminders([approved({ publishResults: { igStories: { status: 'published', via: 'business-suite' } } })], now)).toEqual([]);
        expect(businessSuiteReminders([approved({ publishAlert: { kind: 'business-suite', at: now.toISOString() } })], now)).toEqual([]);
        expect(businessSuiteReminders([approved({ storyLink: '' })], now)).toEqual([]);
    });
});

describe('businessSuiteUrl', () => {
    it('apre la pagina del cliente se l\'ID è numerico', () => {
        expect(businessSuiteUrl('123')).toBe('https://business.facebook.com/latest/home?asset_id=123');
        expect(businessSuiteUrl('x&y')).toBe('https://business.facebook.com/latest/home');
    });
});

describe('impronta di approvazione', () => {
    it('i contenuti senza sticker hanno la stessa impronta di prima', () => {
        const c = base({ imageUrls: ['https://f/1.jpg'], storyLink: 'https://sito.it' });
        expect(contentFingerprint({ ...c, storyLinkStickers: [] })).toBe(contentFingerprint(c));
        expect(contentFingerprint({ ...c, storyLinkStickers: undefined })).toBe(contentFingerprint(c));
    });
    it('cambiare il link di uno sticker cambia l\'impronta (va riapprovato)', () => {
        const c = base({ imageUrls: ['https://f/1.jpg'], storyLinkStickers: [{ slide: 0, url: 'https://a.it' }] });
        expect(contentFingerprint({ ...c, storyLinkStickers: [{ slide: 0, url: 'https://b.it' }] })).not.toBe(contentFingerprint(c));
    });
});
