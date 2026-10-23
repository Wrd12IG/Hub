/**
 * components/story-editor/video-poster.ts
 *
 * Il primo fotogramma di un video di sfondo, come tela piccola: serve all'anteprima nell'editor e al JPEG di riserva della
 * slide (dove il video non si può mettere). Letto dal file appena scelto, o scaricato una volta; mai blocca l'editor:
 * se il browser non decodifica il video restituisce null e la slide resta con sfondo scuro.
 */
import { fetchMediaBuffer, getLocalFile } from './local-media';

const cache = new Map<string, HTMLCanvasElement | null>();
const pending = new Map<string, Promise<HTMLCanvasElement | null>>();
const key = (url: string, t: number) => `${url}@${Math.round(t * 10) / 10}`;

export function cachedPoster(url: string, t: number): HTMLCanvasElement | null {
    return cache.get(key(url, t)) || null;
}

export function loadPoster(url: string, t = 0, maxWidth = 540): Promise<HTMLCanvasElement | null> {
    if (!url || typeof document === 'undefined') return Promise.resolve(null);
    const k = key(url, t);
    if (cache.has(k)) return Promise.resolve(cache.get(k) || null);
    const inFlight = pending.get(k);
    if (inFlight) return inFlight;
    const p = (async () => {
        let objectUrl = '';
        try {
            const buffer = await fetchMediaBuffer(url);
            objectUrl = URL.createObjectURL(new Blob([buffer], { type: getLocalFile(url)?.type || 'video/mp4' }));
            const video = document.createElement('video');
            video.muted = true; video.playsInline = true; video.preload = 'auto';
            video.src = objectUrl;
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('timeout')), 20_000);
                video.onloadedmetadata = () => { video.currentTime = Math.min(Math.max(0, t), Math.max(0, (video.duration || 0) - 0.1)); };
                video.onseeked = () => { clearTimeout(timer); resolve(); };
                video.onerror = () => { clearTimeout(timer); reject(new Error('decode')); };
            });
            if (!video.videoWidth) return null;
            const k2 = Math.min(1, maxWidth / video.videoWidth);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(video.videoWidth * k2); canvas.height = Math.round(video.videoHeight * k2);
            canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
            return canvas;
        } catch {
            return null;
        } finally {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        }
    })().then((c) => { cache.set(k, c); pending.delete(k); return c; });
    pending.set(k, p);
    return p;
}
