'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/client-api-auth';
import { viaProxy } from '@/lib/story-editor/proxy';

const blobs = new Map<string, string>();

/** Scarica un media passando dal proxy del Hub (serve il token: un <img src> normale non lo manda) e ne dà un indirizzo blob. */
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

export function ProxiedImg({ url, alt, className }: { url: string; alt: string; className?: string }) {
    const [src, setSrc] = useState<string | null>(viaProxy(url) === url ? url : null);
    useEffect(() => {
        let alive = true;
        proxiedBlobUrl(url).then((s) => { if (alive) setSrc(s); });
        return () => { alive = false; };
    }, [url]);
    // eslint-disable-next-line @next/next/no-img-element
    return src ? <img src={src} alt={alt} loading="lazy" className={className} /> : <div className={`${className ?? ''} bg-muted animate-pulse`} />;
}
