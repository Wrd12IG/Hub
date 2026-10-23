/**
 * lib/creative/to-ped.ts
 * Trasforma un risultato del Generatore Creativo in un contenuto del PED, SEMPRE come bozza: la pubblicazione
 * resta dopo l'approvazione del cliente (o di un amministratore), come per ogni altro contenuto.
 */
import type { EditorialContent } from '@/lib/data';
import type { CreativeChannel, CreativeItem, CreativeKind } from './spec';

type PedDraft = Omit<EditorialContent, 'id'>;

export function pedFormat(kind: CreativeKind, channel: CreativeChannel, item: Pick<CreativeItem, 'slides'>): string {
    if (kind === 'hooks') return 'Reel';
    if (kind === 'carousel' || item.slides.length > 1) return 'Carosello';
    if (channel === 'tiktok' || channel === 'youtube') return 'Reel';
    return 'Post Singolo';
}

/** Il testo che finisce nel campo «testo» del contenuto: ciò che serve a chi produce e a chi approva. */
export function pedCopy(kind: CreativeKind, item: CreativeItem): string {
    if (kind === 'hooks') {
        return [
            item.spoken && `PARLATO: ${item.spoken}`,
            item.onScreen && `A SCHERMO: ${item.onScreen}`,
            item.visual && `PRIMO FOTOGRAMMA: ${item.visual}`,
            item.loopClose && `CHIUSURA: ${item.loopClose}`,
            item.cta && `INVITO FINALE: ${item.cta}`,
        ].filter(Boolean).join('\n\n');
    }
    const slides = item.slides.length > 0 ? item.slides.map((s, i) => `Slide ${i + 1}${s.role ? ` (${s.role})` : ''}: ${s.text}`).join('\n') : '';
    return [slides && `${slides}`, item.caption && (slides ? `DIDASCALIA:\n${item.caption}` : item.caption)].filter(Boolean).join('\n\n');
}

export function pedTitle(kind: CreativeKind, item: CreativeItem, topic: string): string {
    const base = (kind === 'hooks' ? item.onScreen || item.spoken : item.hook || item.caption.split('\n')[0]) || topic;
    const t = base.replace(/\s+/g, ' ').trim();
    return t.length > 80 ? `${t.slice(0, 77)}…` : t;
}

export function buildPedDraft(args: {
    clientId: string;
    kind: CreativeKind;
    channel: CreativeChannel;
    item: CreativeItem;
    topic: string;
    /** yyyy-MM-dd */
    publicationDate: string;
}): PedDraft {
    const { clientId, kind, channel, item, topic, publicationDate } = args;
    return {
        clientId,
        topic: pedTitle(kind, item, topic),
        format: pedFormat(kind, channel, item),
        status: 'Bozza',
        publicationDate,
        copy: pedCopy(kind, item),
        facebook: channel === 'facebook',
        instagram: channel === 'instagram',
        linkedin: channel === 'linkedin',
        tiktok: channel === 'tiktok',
        youtube: channel === 'youtube',
        gbp: false,
        ...(item.hashtags.length > 0 ? { tags: item.hashtags.join(' ') } : {}),
    };
}
