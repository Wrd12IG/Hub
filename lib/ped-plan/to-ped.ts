/**
 * lib/ped-plan/to-ped.ts
 * Il piano diventa bozze del PED: SEMPRE in «Bozza» (l'approvazione del cliente, o di un amministratore, viene dopo). Il testo
 * che uscirà sul profilo (`copy`) è solo la didascalia; copione, slide e fotogrammi stanno in `proposal`.
 */
import type { EditorialContent } from '@/lib/data';
import { publicationValue } from '@/lib/story-editor/schedule';
import type { PlanPost } from './spec';

type Draft = Omit<EditorialContent, 'id'>;

export function pedTitle(p: Pick<PlanPost, 'theme' | 'format' | 'hook' | 'carousel'>): string {
    const base = (p.format === 'Carosello' ? p.carousel?.slides[0]?.headline : '') || p.hook.onScreen || p.theme;
    const t = base.replace(/\s+/g, ' ').trim();
    return t.length > 80 ? `${t.slice(0, 77)}…` : t;
}

/** La proposta in testo JSON, senza gli avvisi (servono a chi rivede il piano, non a chi produce). */
export function proposalJson(p: PlanPost): string {
    const { warnings: _w, ...rest } = p;
    return JSON.stringify(rest);
}

export function parseProposal(raw: unknown): PlanPost | null {
    if (typeof raw !== 'string' || !raw) return null;
    try {
        const o = JSON.parse(raw);
        return o && typeof o === 'object' && typeof o.format === 'string' ? ({ warnings: [], ...o } as PlanPost) : null;
    } catch {
        return null;
    }
}

export function buildPedDraft(clientId: string, p: PlanPost): Draft {
    const isStory = p.format === 'Storia';
    return {
        clientId,
        topic: pedTitle(p),
        format: p.format,
        status: 'Bozza',
        publicationDate: publicationValue(p.date, p.time),
        focus: p.angle,
        // La storia non ha didascalia; per gli altri è il testo che esce sul profilo, con l'invito già dentro
        copy: isStory ? '' : p.caption,
        facebook: false,
        instagram: !isStory,
        igStories: isStory,
        linkedin: false,
        tiktok: false,
        youtube: false,
        gbp: false,
        ...(p.hashtags.length > 0 && !isStory ? { tags: p.hashtags.join(' ') } : {}),
        proposal: proposalJson(p),
    };
}

export const buildPedDrafts = (clientId: string, posts: PlanPost[]): Draft[] => posts.map((p) => buildPedDraft(clientId, p));
