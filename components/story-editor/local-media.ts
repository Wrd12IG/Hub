/**
 * components/story-editor/local-media.ts
 *
 * I file appena scelti dal computer (video, GIF) restano in memoria finché la pagina è aperta: per esportare la storia in
 * video si leggono da qui invece di riscaricarli, e un video da 80 MB non deve passare dal server del Hub (il proxy dei
 * media ha un tetto di 25 MB). Dopo un ricaricamento della pagina si ricade sul download.
 */
import { authFetch } from '@/lib/client-api-auth';
import { isProxyable, viaProxy } from '@/lib/story-editor/proxy';

const files = new Map<string, File>();

export function rememberLocalFile(url: string, file: File): void {
    files.set(url, file);
}

export function getLocalFile(url: string): File | undefined {
    return files.get(url);
}

/** I byte di un file: dalla memoria se è appena stato scelto, altrimenti scaricandolo (dal proxy del Hub se serve). */
export async function fetchMediaBuffer(url: string): Promise<ArrayBuffer> {
    const local = files.get(url);
    if (local) return local.arrayBuffer();
    const res = isProxyable(url) ? await authFetch(viaProxy(url)) : await fetch(url);
    if (!res.ok) throw new Error(res.status === 413 || res.status === 502 ? 'Il file è troppo grande per essere riletto dal server: caricalo di nuovo dal computer.' : `Non riesco a leggere il file (${res.status}).`);
    return res.arrayBuffer();
}
