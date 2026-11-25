/**
 * lib/content-approval.ts
 *
 * Approvazione dei post da parte del cliente, via link pubblico. Logica pura (nessun I/O): le route fanno solo lettura
 * e scrittura. Lo stato del contenuto è quello del Piano Editoriale: 'Approvato' è l'unico che la cron di pubblicazione
 * considera pubblicabile, quindi la risposta del cliente è ciò che "sblocca" l'uscita del post.
 */
import type { ContentApproval, EditorialContent } from './data';
import { isStaffUser } from './roles';

export const STATUS_PENDING = 'In Approvazione Cliente';
/** Il cliente chiede modifiche: il contenuto torna in bozza (lo stato che il Piano Editoriale già usa), col suo commento. */
export const STATUS_CHANGES = 'Bozza';
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
    content: Pick<EditorialContent, 'approval'> & Partial<EditorialContent>, d: Decision & { name?: string }, now: Date,
): { status: string; approval: ContentApproval } | null {
    if (content.approval?.status !== 'requested') return null;
    const base = { ...content.approval, respondedAt: now.toISOString(), respondedBy: d.name };
    return d.decision === 'approve'
        ? { status: STATUS_APPROVED, approval: { ...base, status: 'approved', comment: undefined, contentHash: contentFingerprint(content) } }
        : { status: STATUS_CHANGES, approval: { ...base, status: 'changes', comment: d.comment } };
}

/** Chi può saltare il cliente: gli Amministratori e chi ha il permesso esplicito sul proprio profilo. */
export function canBypassApproval(user: { id?: string; role?: string; status?: string; canSkipClientApproval?: boolean } | null): boolean {
    // Solo chi ha un ruolo dello staff che esiste ed è attivo: un ruolo mancante o sconosciuto non salta l'approvazione
    return !!user && isStaffUser({ id: user.id ?? '', role: user.role, status: user.status }) && (user.role === 'Amministratore' || user.canSkipClientApproval === true);
}

/** Approvazione interna: lascia traccia di chi l'ha data, così non si confonde con una risposta del cliente. */
export function bypassApproval(byName: string, now: Date, requestedBy?: string, content?: Partial<EditorialContent>): { status: string; approval: ContentApproval } {
    const iso = now.toISOString();
    return {
        status: STATUS_APPROVED,
        approval: { status: 'approved', requestedAt: iso, requestedBy, respondedAt: iso, respondedBy: byName, bypass: true, ...(content ? { contentHash: contentFingerprint(content) } : {}) },
    };
}

/** Ciò che il cliente approva: testo, media e canali. Non la data (spostare un post approvato non lo rende un altro post). */
const FINGERPRINT_FIELDS = ['copy', 'hashtags', 'mentions', 'storyLink', 'imageUrls', 'videoUrl', 'coverUrl', 'storyMedia',
    'facebook', 'instagram', 'igStories', 'fbStories', 'linkedin', 'tiktok', 'youtube', 'gbp'] as const;

/** Impronta stabile (cyrb53) dei campi approvati. Non è crittografica: serve solo a notare che qualcosa è cambiato. */
export function contentFingerprint(c: Partial<EditorialContent>): string {
    const o: Record<string, unknown> = {};
    for (const f of FINGERPRINT_FIELDS) {
        const v = (c as Record<string, unknown>)[f];
        // vuoto, assente e falso sono la stessa cosa: un campo che si svuota non deve cambiare l'impronta per sbaglio
        o[f] = v === undefined || v === null || v === false || v === '' || (Array.isArray(v) && v.length === 0) ? null : v;
    }
    const str = JSON.stringify(o);
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export type PublishGate =
    | { ok: true }
    | { ok: false; reason: 'not-approved' | 'no-approval' | 'changed-after-approval'; message: string };

/**
 * Il post può uscire solo se è «Approvato» E l'approvazione è vera: data dal cliente o dall'interno (bypass) e riferita a ciò che c'è ora.
 * Lo stato da solo non basta: dal menu del Piano Editoriale chiunque dello staff può scriverlo.
 * Le approvazioni fatte prima di questa regola non hanno l'impronta: restano valide (non si blocca ciò che era già approvato).
 */
export function approvalGate(content: Pick<EditorialContent, 'status' | 'approval'> & Partial<EditorialContent>): PublishGate {
    if (content.status !== STATUS_APPROVED) return { ok: false, reason: 'not-approved', message: 'non è in stato Approvato' };
    if (content.approval?.status !== 'approved') {
        return { ok: false, reason: 'no-approval', message: 'manca l\'approvazione: richiedila al cliente o approvala come amministratore' };
    }
    if (content.approval.contentHash && content.approval.contentHash !== contentFingerprint(content)) {
        return { ok: false, reason: 'changed-after-approval', message: 'è stato modificato dopo l\'approvazione: riapprovalo' };
    }
    return { ok: true };
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

export const CHANNEL_LABEL: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram', igStories: 'Storie Instagram', linkedin: 'LinkedIn',
    fbStories: 'Storie Facebook', tiktok: 'TikTok', youtube: 'YouTube', gbp: 'Google Business Profile',
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
