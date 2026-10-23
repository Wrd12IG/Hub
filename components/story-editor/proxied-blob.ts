import { authFetch } from '@/lib/client-api-auth';
import { viaProxy } from '@/lib/story-editor/proxy';

/** Scarica un media passando dal proxy del Hub (serve il token: un <img src> normale non lo manda) e ne dà un indirizzo blob. */
const blobs = new Map<string, string>();

export async function proxiedBlobUrl(url: string): Promise<string | null> {
    const src = viaProxy(url);
    if (src === url) return url; // non passa dal proxy (già dello stesso dominio / Firebase)
    const hit = blobs.get(src);
    if (hit) return hit;
    try {
        const res = await authFetch(src);
        if (!res.ok) return null;
        const obj = URL.createObjectURL(await res.blob());
        blobs.set(src, obj);
        return obj;
    } catch { return null; }
}

