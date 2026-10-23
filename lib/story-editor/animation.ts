/**
 * lib/story-editor/animation.ts
 *
 * Cosa si muove in una storia e per quanto: una slide con uno sfondo video o con una GIF animata esce come MP4,
 * tutte le altre restano immagini. Qui solo funzioni pure (durate, fotogramma della GIF a un dato istante, elenco dei
 * media per la pubblicazione); la codifica vera sta in components/story-editor/export-video.ts (solo browser).
 */
import type { ImageLayer, Layer, Slide } from './types';

/** Instagram accetta storie video da 3 a 60 secondi (formato MP4 H.264, 9:16). */
export const MIN_STORY_SECONDS = 3;
export const MAX_STORY_SECONDS = 60;
/** Una slide con sole GIF (niente video di sfondo) dura abbastanza da far girare la GIF più volte, ma non all'infinito. */
export const GIF_TARGET_SECONDS = 6;
export const GIF_MAX_SECONDS = 15;
export const VIDEO_FPS = 30;

export function isGifUrl(url: string): boolean {
    try {
        const path = decodeURIComponent(url.split('?')[0]).toLowerCase();
        return path.endsWith('.gif');
    } catch {
        return false;
    }
}

export function isAnimatedLayer(layer: Layer): layer is ImageLayer {
    return layer.type === 'image' && !layer.hidden && (layer.source === 'gif' || isGifUrl(layer.url));
}

export function hasVideoBackground(slide: Slide): boolean {
    return slide.background.type === 'video';
}

/** Una slide esce come video se ha un video di sfondo o almeno una GIF animata visibile. */
export function isVideoSlide(slide: Slide): boolean {
    return hasVideoBackground(slide) || slide.layers.some(isAnimatedLayer);
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Inizio e fine (secondi) da usare di un video di sfondo; trimEnd 0 o oltre la durata = fino alla fine. */
export function trimRange(trimStart: number, trimEnd: number, duration: number): { start: number; end: number } {
    const total = isFinite(duration) && duration > 0 ? duration : 0;
    const start = clamp(trimStart || 0, 0, Math.max(0, total - 0.1));
    const end = !trimEnd || trimEnd <= start || trimEnd > total ? total : trimEnd;
    return { start, end: Math.max(end, start) };
}

/**
 * Durata in secondi della slide video.
 * - video di sfondo: la parte scelta, tenuta fra 3 e 60 secondi (se è più corta di 3 s, la storia resta ferma sull'ultimo fotogramma);
 * - solo GIF: il ciclo più lungo ripetuto fino a ~6 s (mai oltre 15 s).
 */
export function slideDurationSeconds(slide: Slide, opts: { videoDuration?: number; gifCycles?: number[] }): number {
    if (slide.background.type === 'video') {
        const { start, end } = trimRange(slide.background.trimStart, slide.background.trimEnd, opts.videoDuration || 0);
        return clamp(end - start, MIN_STORY_SECONDS, MAX_STORY_SECONDS);
    }
    const cycle = Math.max(0, ...(opts.gifCycles || []));
    if (cycle <= 0) return GIF_TARGET_SECONDS;
    const repeats = Math.max(1, Math.ceil(GIF_TARGET_SECONDS / cycle));
    return clamp(cycle * repeats, MIN_STORY_SECONDS, GIF_MAX_SECONDS);
}

/** Ritardi dei fotogrammi di una GIF (ms): quelli troppo brevi o assenti valgono 100 ms, come fanno i browser. */
export function normalizeDelays(delays: number[]): number[] {
    return delays.map((d) => (d && d >= 20 ? d : 100));
}

export function cycleSeconds(delaysMs: number[]): number {
    return normalizeDelays(delaysMs).reduce((a, b) => a + b, 0) / 1000;
}

/** Quale fotogramma della GIF mostrare dopo `tSeconds` (la GIF riparte da capo quando finisce). */
export function gifFrameIndexAt(delaysMs: number[], tSeconds: number): number {
    const delays = normalizeDelays(delaysMs);
    if (delays.length === 0) return 0;
    const total = delays.reduce((a, b) => a + b, 0);
    let t = ((tSeconds * 1000) % total + total) % total;
    for (let i = 0; i < delays.length; i++) {
        if (t < delays[i]) return i;
        t -= delays[i];
    }
    return delays.length - 1;
}

export function frameCount(durationSeconds: number, fps = VIDEO_FPS): number {
    return Math.max(1, Math.round(durationSeconds * fps));
}

export interface StoryMediaItem { url: string; kind: 'image' | 'video' }

/**
 * L'elenco finale dei media di una storia, nell'ordine delle slide: il video per le slide animate, il JPEG per le altre.
 * Se per una slide animata manca il video (esportazione non riuscita) si ricade sul JPEG: meglio ferma che persa.
 */
export function buildStoryMedia(slides: Slide[], jpegUrls: string[], videoUrlBySlideId: Record<string, string>): StoryMediaItem[] {
    const out: StoryMediaItem[] = [];
    slides.forEach((slide, i) => {
        const video = videoUrlBySlideId[slide.id];
        if (video) out.push({ url: video, kind: 'video' });
        else if (jpegUrls[i]) out.push({ url: jpegUrls[i], kind: 'image' });
    });
    return out;
}
