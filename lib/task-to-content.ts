/**
 * lib/task-to-content.ts
 *
 * Dal task approvato al contenuto programmato (Brief → Task → Programmazione contenuto): regole pure, senza I/O.
 * La finestra è components/publish-to-editorial-modal.tsx.
 */
import type { Attachment, Task } from './data';

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)(\?|$)/i;
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)(\?|$)/i;

const isHttps = (u: string) => /^https:\/\//i.test(u);

export interface TaskMedia { images: Attachment[]; videos: Attachment[] }

/** Immagini e video allegati al task, solo con URL https (gli altri non sono raggiungibili da Instagram e Facebook). */
export function splitTaskMedia(attachments: Attachment[] | undefined): TaskMedia {
    const out: TaskMedia = { images: [], videos: [] };
    for (const a of attachments || []) {
        if (!a?.url || !isHttps(a.url)) continue;
        const probe = `${a.filename || ''} ${a.url}`;
        if ((a.type || '').startsWith('video/') || VIDEO_EXT.test(probe)) out.videos.push(a);
        else if ((a.type || '').startsWith('image/') || IMAGE_EXT.test(probe)) out.images.push(a);
    }
    return out;
}

/** Formato suggerito dai media scelti: video → Reel, più immagini → Carosello, una → Post Singolo. */
export function suggestFormat(imageCount: number, hasVideo: boolean): string {
    if (hasVideo) return 'Reel';
    if (imageCount >= 2) return 'Carosello';
    return 'Post Singolo';
}

export type Eligibility = { ok: true } | { ok: false; reason: string };

/** Solo un task approvato, e non già collegato a un contenuto, può essere programmato. */
export function canScheduleFromTask(task: Pick<Task, 'status' | 'editorialContentId'> | null | undefined): Eligibility {
    if (!task) return { ok: false, reason: 'Nessun task' };
    if (task.editorialContentId) return { ok: false, reason: 'Contenuto già programmato' };
    if (task.status !== 'Approvato') return { ok: false, reason: 'Disponibile dopo l\'approvazione del task' };
    return { ok: true };
}
