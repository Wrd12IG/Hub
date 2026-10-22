/**
 * lib/content-approval.ts
 *
 * Approvazione dei post da parte del cliente, via link pubblico. Logica pura (nessun I/O): le route fanno solo lettura
 * e scrittura. Lo stato del contenuto è quello del Piano Editoriale: 'Approvato' è l'unico che la cron di pubblicazione
 * considera pubblicabile, quindi la risposta del cliente è ciò che "sblocca" l'uscita del post.
 */
import type { ContentApproval, EditorialContent } from './data';

export const STATUS_PENDING = 'In Approvazione Cliente';
export const STATUS_CHANGES = 'Da Modificare';
export const STATUS_APPROVED = 'Approvato';
export const COMMENT_MAX = 1000;
export const NAME_MAX = 80;

/** Stati da cui non si chiede più approvazione: il post è già uscito o sta uscendo. */
const LOCKED = new Set(['Pubblicato', 'Completato']);

export function canRequestApproval(content: Pick<EditorialContent, 'status' | 'approval'>): { ok: true } | { ok: false; reason: string } {
    if (LOCKED.has(content.status)) return { ok: false, reason: 'già pubblicato' };
    if (content.approval?.status === 'requested') return { ok: false, reason: 'già in attesa del cliente' };
    return { ok: true };
}

export function requestApproval(by: string, now: Date): { status: string; approval: ContentApproval } {
    return { status: STATUS_PENDING, approval: { status: 'requested', requestedAt: now.toISOString(), requestedBy: by } };
}

export type Decision = { decision: 'approve' } | { decision: 'changes'; comment: string };

/** Valida l'input grezzo dell'endpoint pubblico. "Chiedi modifiche" senza spiegare cosa cambiare non serve a nessuno. */
export function parseDecision(body: any): { ok: true; value: Decision & { name?: string } } | { ok: false; error: string } {
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, NAME_MAX) || undefined : undefined;
    if (body?.decision === 'approve') return { ok: true, value: { decision: 'approve', name } };
    if (body?.decision === 'changes') {
        const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, COMMENT_MAX) : '';
        if (!comment) return { ok: false, error: 'Scrivi cosa vuoi cambiare' };
        return { ok: true, value: { decision: 'changes', comment, name } };
    }
    return { ok: false, error: 'Scelta non valida' };
}

/** Applica la risposta del cliente. Solo un contenuto in attesa può ricevere una risposta (null = non si può). */
export function applyDecision(
    content: Pick<EditorialContent, 'approval'>, d: Decision & { name?: string }, now: Date,
): { status: string; approval: ContentApproval } | null {
    if (content.approval?.status !== 'requested') return null;
    const base = { ...content.approval, respondedAt: now.toISOString(), respondedBy: d.name };
    return d.decision === 'approve'
        ? { status: STATUS_APPROVED, approval: { ...base, status: 'approved', comment: undefined } }
        : { status: STATUS_CHANGES, approval: { ...base, status: 'changes', comment: d.comment } };
}

export interface PublicContent {
    id: string;
    topic: string;
    format: string;
    publicationDate: string | null;
    copy: string;
    imageUrls: string[];
    videoUrl: string | null;
    channels: string[];
}

const CHANNEL_LABEL: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram', igStories: 'Storie Instagram', linkedin: 'LinkedIn',
    tiktok: 'TikTok', youtube: 'YouTube', gbp: 'Google Business Profile',
};

/**
 * Ciò che il cliente vede di un contenuto. LISTA BIANCA costruita campo per campo: tag interni, task, progetto,
 * campi personalizzati, esiti tecnici di pubblicazione non devono poter uscire per distrazione.
 */
export function toPublicContent(c: EditorialContent): PublicContent {
    return {
        id: c.id,
        topic: c.topic || '',
        format: c.format || '',
        publicationDate: c.publicationDate || null,
        copy: c.copy || '',
        imageUrls: (c.imageUrls || []).filter((u) => /^https:\/\//i.test(u)),
        videoUrl: c.videoUrl && /^https:\/\//i.test(c.videoUrl) ? c.videoUrl : null,
        channels: Object.keys(CHANNEL_LABEL).filter((k) => (c as any)[k]).map((k) => CHANNEL_LABEL[k]),
    };
}
