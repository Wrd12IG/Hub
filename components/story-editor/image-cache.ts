/**
 * Cache delle immagini dell'editor. Le immagini passano da /api/stories/media-proxy (stesso dominio), così la tela
 * resta «pulita» e si può esportare. Per l'esportazione si precaricano tutte e poi si disegna senza attese.
 */
import { viaProxy } from '@/lib/story-editor/proxy';

const cache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement | null>>();

export function cachedImage(url: string): HTMLImageElement | null {
    return cache.get(viaProxy(url)) || null;
}

export function loadImage(url: string): Promise<HTMLImageElement | null> {
    const src = viaProxy(url);
    const hit = cache.get(src);
    if (hit) return Promise.resolve(hit);
    const inFlight = pending.get(src);
    if (inFlight) return inFlight;
    const p = new Promise<HTMLImageElement | null>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { cache.set(src, img); pending.delete(src); resolve(img); };
        img.onerror = () => { pending.delete(src); resolve(null); };
        img.src = src;
    });
    pending.set(src, p);
    return p;
}

export async function preloadImages(urls: string[]): Promise<void> {
    await Promise.all(Array.from(new Set(urls.filter(Boolean))).map(loadImage));
}
