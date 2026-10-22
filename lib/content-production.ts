/**
 * lib/content-production.ts
 *
 * Dal contenuto del PED ai task di produzione (grafica, video, foto) e ritorno dei media dai task al contenuto.
 * Il giro: il team crea il contenuto in bozza → apre i task di produzione (pulsante) → carica i file nei task →
 * li importa nel contenuto → chiede l'approvazione del cliente (che vede idea, testo E grafica finita) → pubblica.
 * Pura (nessun I/O). Le scadenze si calcolano all'indietro dalla data di pubblicazione (lib/content-workplan.ts).
 */
import type { EditorialContent, Task } from './data';
import { proposeWorkplan, type WorkStep } from './content-workplan';
import { splitTaskMedia } from './task-to-content';

export type ProductionType = 'graphic' | 'video' | 'photo';

/**
 * Giorni lavorativi prima della pubblicazione entro cui il lavoro deve essere pronto: lasciano spazio alla revisione
 * interna e ai 3 giorni lavorativi che il cliente ha per approvare il materiale finito.
 */
export const PRODUCTION_TYPES: Record<ProductionType, { label: string; daysBefore: number; minutes: number }> = {
    graphic: { label: 'Grafica', daysBefore: 6, minutes: 120 },
    video: { label: 'Video', daysBefore: 8, minutes: 240 },
    photo: { label: 'Foto', daysBefore: 7, minutes: 90 },
};

/** Quali lavorazioni proporre di default, dal formato e dai canali del contenuto. */
export function suggestProductionTypes(c: Pick<EditorialContent, 'format' | 'videoUrl' | 'tiktok' | 'youtube' | 'instagram' | 'facebook' | 'linkedin' | 'igStories'>): ProductionType[] {
    const fmt = (c.format || '').toLowerCase();
    const out: ProductionType[] = [];
    if (/reel|video/.test(fmt) || c.videoUrl || c.tiktok || c.youtube) out.push('video');
    if (/storia|story|carosello|post|grafic|immagin/.test(fmt) || out.length === 0) out.push('graphic');
    return out;
}

export interface ProposedProduction { type: ProductionType; title: string; dueDate: string; minutes: number; late: boolean }

/** Una riga per tipo scelto. null se la data di pubblicazione manca o è passata (non si pianifica all'indietro dal nulla). */
export function proposeProduction(content: Pick<EditorialContent, 'topic' | 'publicationDate'>, types: ProductionType[], today: string): ProposedProduction[] | null {
    const steps: WorkStep[] = types.map((t) => ({ key: t, title: `${PRODUCTION_TYPES[t].label}: ${content.topic}`, daysBefore: PRODUCTION_TYPES[t].daysBefore, minutes: PRODUCTION_TYPES[t].minutes }));
    const plan = proposeWorkplan(content.publicationDate, today, steps);
    if (!plan) return null;
    return plan.map((p) => ({ type: p.key as ProductionType, title: p.title, dueDate: p.dueDate, minutes: p.minutes, late: p.late }));
}

export interface TaskMediaItem { url: string; filename: string; kind: 'image' | 'video'; taskTitle: string }

/** Immagini e video allegati ai task collegati, senza doppioni. */
export function collectTaskMedia(tasks: Pick<Task, 'title' | 'attachments'>[]): TaskMediaItem[] {
    const seen = new Set<string>();
    const out: TaskMediaItem[] = [];
    for (const t of tasks) {
        const { images, videos } = splitTaskMedia(t.attachments);
        for (const a of images) if (!seen.has(a.url)) { seen.add(a.url); out.push({ url: a.url, filename: a.filename, kind: 'image', taskTitle: t.title }); }
        for (const a of videos) if (!seen.has(a.url)) { seen.add(a.url); out.push({ url: a.url, filename: a.filename, kind: 'video', taskTitle: t.title }); }
    }
    return out;
}

/** Aggiunge i media scelti al contenuto: le immagini si accodano senza doppioni, il video c'è uno solo (il nuovo sostituisce). */
export function mergeMedia(content: Pick<EditorialContent, 'imageUrls' | 'videoUrl'>, picked: { images: string[]; video?: string }): { imageUrls: string[]; videoUrl: string } {
    const imageUrls = Array.from(new Set([...(content.imageUrls || []).filter(Boolean), ...picked.images]));
    return { imageUrls, videoUrl: picked.video || content.videoUrl || '' };
}

/** Canali scelti che non possono uscire senza un'immagine o un video (Instagram e Storie Instagram). */
export function channelsMissingMedia(c: Pick<EditorialContent, 'imageUrls' | 'videoUrl' | 'instagram' | 'igStories'>): string[] {
    const hasMedia = (c.imageUrls || []).some(Boolean) || !!c.videoUrl;
    if (hasMedia) return [];
    return [c.instagram ? 'Instagram' : '', c.igStories ? 'Storie Instagram' : ''].filter(Boolean);
}

/** Id dei task di produzione di un contenuto: l'elenco, più il vecchio campo singolo per i contenuti già esistenti. */
export function linkedTaskIds(c: Pick<EditorialContent, 'taskId' | 'taskIds'>): string[] {
    return Array.from(new Set([...(c.taskIds || []), ...(c.taskId ? [c.taskId] : [])]));
}
