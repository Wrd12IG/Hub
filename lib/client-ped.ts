/**
 * lib/client-ped.ts
 *
 * Il PED come lo vede il cliente: che contenuti, con quali campi. Pura (nessun I/O).
 *
 * ⚠️ È una LISTA BIANCA, costruita campo per campo: task, progetto, campi personalizzati, tag interni, id degli account,
 * esiti tecnici e messaggi d'errore di pubblicazione non devono poter uscire per distrazione.
 */
import type { EditorialContent } from './data';
import { CHANNEL_LABEL } from './content-approval';

export interface ClientPedItem {
    id: string;
    topic: string;
    format: string;
    status: string;
    publicationDate: string | null;
    copy: string;
    hashtags: string;
    mentions: string;
    storyLink: string;
    imageUrls: string[];
    videoUrl: string | null;
    coverUrl: string | null;
    channels: string[];
    /** Il cliente deve rispondere: Approva / Chiedi modifiche. */
    awaitingClient: boolean;
    approval: { status: 'requested' | 'approved' | 'changes'; comment: string | null; respondedBy: string | null; respondedAt: string | null } | null;
    /** Dove è uscito, per i contenuti pubblicati (solo link, mai errori). */
    published: { channel: string; url: string | null }[];
}

const https = (u?: string | null) => (u && /^https:\/\//i.test(u) ? u : null);

/**
 * Le bozze del team non si vedono: il cliente vede ciò che gli è stato mandato (o lo ha già deciso). Una bozza torna a
 * essere visibile solo se è tornata indietro per le sue modifiche, così sa che la richiesta è presa in carico.
 */
export function isVisibleToClient(c: Pick<EditorialContent, 'status' | 'approval'>): boolean {
    return c.status !== 'Bozza' || c.approval?.status === 'changes';
}

export function toClientPedItem(c: EditorialContent): ClientPedItem {
    const channels = Object.keys(CHANNEL_LABEL).filter((k) => !!(c as any)[k]).map((k) => CHANNEL_LABEL[k]);
    const published = Object.entries(c.publishResults || {})
        .filter(([, st]) => st?.status === 'published')
        .map(([k, st]) => ({ channel: CHANNEL_LABEL[k] || k, url: https(st?.postUrl) }));
    const a = c.approval;
    return {
        id: c.id,
        topic: c.topic || '',
        format: c.format || '',
        status: c.status || '',
        publicationDate: c.publicationDate || null,
        copy: c.copy || '',
        hashtags: c.tags || '',
        mentions: c.mentions || '',
        storyLink: c.storyLink || '',
        imageUrls: (c.imageUrls || []).map(https).filter((u): u is string => !!u),
        videoUrl: https(c.videoUrl),
        coverUrl: https(c.coverUrl),
        channels,
        awaitingClient: a?.status === 'requested',
        approval: a ? { status: a.status, comment: a.comment || null, respondedBy: a.respondedBy || null, respondedAt: a.respondedAt || null } : null,
        published,
    };
}

/** Prima quelli da approvare, poi per data di pubblicazione (senza data in fondo). */
export function sortForClient(items: ClientPedItem[]): ClientPedItem[] {
    return [...items].sort((a, b) => {
        if (a.awaitingClient !== b.awaitingClient) return a.awaitingClient ? -1 : 1;
        const da = a.publicationDate || '9999', db = b.publicationDate || '9999';
        return da.localeCompare(db);
    });
}
