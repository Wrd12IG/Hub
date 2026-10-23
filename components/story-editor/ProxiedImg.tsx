'use client';

import { useEffect, useState } from 'react';
import { proxiedBlobUrl } from './proxied-blob';
import { viaProxy } from '@/lib/story-editor/proxy';

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
