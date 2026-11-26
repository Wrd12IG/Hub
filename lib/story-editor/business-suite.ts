/**
 * lib/story-editor/business-suite.ts
 *
 * Storie con il link sticker. L'API di Meta (e quindi Windsor) pubblica le storie solo come immagine o video: lo sticker
 * link non si può pubblicare da API, si aggiunge solo dall'interfaccia di Meta Business Suite (o dall'app di Instagram).
 * Per questo una storia con un link NON esce da sola: il Hub prepara un «kit» (slide pronte, link per slide, dove mettere
 * lo sticker) e la storia si programma in Business Suite con lo sticker vero.
 *
 * Nell'editor lo sticker «link» è il segnaposto: dice su quale slide va il link e in che zona. Nelle immagini finali non
 * viene disegnato, perché lì andrà lo sticker cliccabile di Instagram.
 *
 * Solo funzioni pure, senza I/O (vedi lib/story-editor/__tests__/business-suite.test.ts).
 */
import type { EditorialContent } from '@/lib/data';
import { STORY_H, type StoryDesign } from './types';

export type StickerArea = 'alto' | 'centro' | 'basso';

/** Un link sticker da aggiungere in Business Suite: indice della slide (da 0), indirizzo e zona indicativa. */
export interface StoryLinkSticker {
    slide: number;
    url: string;
    area?: StickerArea;
}

export interface KitCard {
    index: number;
    url: string;
    kind: 'image' | 'video';
    link?: string;
    area?: StickerArea;
}

/** "www.sito.it/x" → "https://www.sito.it/x"; un testo che non sembra un indirizzo → ''. */
export function normalizeLink(raw: string | undefined | null): string {
    const t = (raw || '').trim();
    if (!t || /\s/.test(t)) return '';
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    try {
        const u = new URL(withProto);
        if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return '';
        return u.toString();
    } catch {
        return '';
    }
}

function areaOf(y: number): StickerArea {
    if (y < STORY_H / 3) return 'alto';
    if (y < (STORY_H * 2) / 3) return 'centro';
    return 'basso';
}

/**
 * I link sticker del progetto, uno per slide (il primo visibile della slide). Se lo sticker non contiene un indirizzo
 * valido si usa il link generale della storia; se non c'è nemmeno quello lo sticker si ignora.
 */
export function linkStickersOf(design: StoryDesign, fallbackLink?: string): StoryLinkSticker[] {
    const fallback = normalizeLink(fallbackLink);
    const out: StoryLinkSticker[] = [];
    design.slides.forEach((slide, i) => {
        const sticker = slide.layers.find((l) => l.type === 'sticker' && l.sticker === 'link' && !l.hidden);
        if (!sticker || sticker.type !== 'sticker') return;
        const url = normalizeLink(sticker.text) || fallback;
        if (url) out.push({ slide: i, url, area: areaOf(sticker.y) });
    });
    return out;
}

/** Il progetto da disegnare nei file finali: gli sticker link sono nascosti (al loro posto va lo sticker vero). */
export function withoutLinkStickers(design: StoryDesign): StoryDesign {
    return {
        ...design,
        slides: design.slides.map((s) => ({
            ...s,
            layers: s.layers.map((l) => (l.type === 'sticker' && l.sticker === 'link' ? { ...l, hidden: true } : l)),
        })),
    };
}

type KitSource = Pick<EditorialContent, 'storyMedia' | 'imageUrls' | 'videoUrl' | 'storyLink' | 'storyLinkStickers'>;

/** Le slide della storia nell'ordine di uscita, con il link sticker dove serve. */
export function storyKit(content: KitSource): KitCard[] {
    const media: { url: string; kind: 'image' | 'video' }[] = content.storyMedia?.length
        ? content.storyMedia.filter((m) => m && m.url)
        : [
            ...(content.imageUrls || []).filter(Boolean).map((url) => ({ url, kind: 'image' as const })),
            ...(content.videoUrl ? [{ url: content.videoUrl, kind: 'video' as const }] : []),
        ];
    const cards: KitCard[] = media.slice(0, 10).map((m, index) => ({ index, url: m.url, kind: m.kind }));
    if (cards.length === 0) return cards;

    const stickers = (content.storyLinkStickers || []).filter((s) => s && cards[s.slide] && normalizeLink(s.url));
    if (stickers.length > 0) {
        for (const s of stickers) { cards[s.slide].link = normalizeLink(s.url); cards[s.slide].area = s.area; }
    } else {
        // Link scritto solo nel PED (nessuno sticker nell'editor): va sull'ultima slide, quella dell'invito all'azione
        const link = normalizeLink(content.storyLink);
        if (link) cards[cards.length - 1].link = link;
    }
    return cards;
}

/** Vero se la storia Instagram ha almeno un link: allora si programma da Business Suite, non esce da sola. */
export function needsBusinessSuite(content: KitSource & Pick<EditorialContent, 'igStories'>): boolean {
    return !!content.igStories && storyKit(content).some((c) => !!c.link);
}

/** Business Suite sulla pagina Facebook del cliente, se il suo ID è noto. */
export function businessSuiteUrl(facebookPageId?: string): string {
    const base = 'https://business.facebook.com/latest/home';
    return facebookPageId && /^\d+$/.test(facebookPageId) ? `${base}?asset_id=${facebookPageId}` : base;
}

export const AREA_LABEL: Record<StickerArea, string> = { alto: 'in alto', centro: 'al centro', basso: 'in basso' };
