/**
 * lib/story-editor/proxy.ts
 *
 * I media esterni (GIF di Giphy, foto di Pexels, file su Firebase) passano da un percorso interno del Hub: la politica di
 * sicurezza non li lascia caricare direttamente e, per esportare la storia, la tela non deve essere «contaminata» da
 * immagini di altri domini. Qui si decide cosa si può far passare: solo https e solo da questi domini.
 */
const ALLOWED_HOSTS = [
    'firebasestorage.googleapis.com',
    'storage.googleapis.com',
    'images.pexels.com',
    'media.giphy.com',
    'media0.giphy.com', 'media1.giphy.com', 'media2.giphy.com', 'media3.giphy.com', 'media4.giphy.com',
    'i.giphy.com',
];

export function isProxyable(raw: string): boolean {
    try {
        const u = new URL(raw);
        return u.protocol === 'https:' && ALLOWED_HOSTS.includes(u.hostname) && !u.username && !u.password;
    } catch {
        return false;
    }
}

/** L'indirizzo da usare nell'editor: interno se serve, invariato se è già del Hub o un file locale. */
export function viaProxy(url: string): string {
    if (!url || url.startsWith('/') || url.startsWith('data:') || url.startsWith('blob:')) return url;
    return isProxyable(url) ? `/api/stories/media-proxy?url=${encodeURIComponent(url)}` : url;
}
