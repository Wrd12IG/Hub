/**
 * lib/story-editor/stock.ts
 *
 * GIF (Giphy), foto d'archivio (Pexels) e media già del cliente, ridotti a un formato unico per i pannelli dell'editor.
 * Pura: legge le risposte dei servizi e restituisce solo ciò che serve, con indirizzi https. Le chiavi restano sul server.
 */
import { isProxyable } from './proxy';

export interface StockItem {
    id: string;
    title: string;
    /** L'immagine da mettere nella storia. */
    url: string;
    /** La miniatura per il pannello. */
    preview: string;
    width: number;
    height: number;
    /** Chi va citato (Pexels lo richiede). */
    credit?: string;
}

const num = (v: unknown, fallback: number): number => {
    const n = typeof v === 'string' ? parseInt(v, 10) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

/** Solo https e solo domini che l'editor sa far passare dal proxy: altrimenti l'immagine non si potrebbe esportare. */
const ok = (u: unknown): u is string => typeof u === 'string' && isProxyable(u);

export function normalizeGiphy(json: any): { items: StockItem[]; nextOffset: number | null } {
    const data: any[] = Array.isArray(json?.data) ? json.data : [];
    const items: StockItem[] = [];
    for (const g of data) {
        const original = g?.images?.original;
        const small = g?.images?.fixed_width || g?.images?.fixed_width_small || original;
        if (!g?.id || !ok(original?.url) || !ok(small?.url)) continue;
        items.push({ id: String(g.id), title: String(g.title || 'GIF'), url: original.url, preview: small.url, width: num(original.width, 480), height: num(original.height, 480) });
    }
    const p = json?.pagination;
    const next = p && typeof p.offset === 'number' && typeof p.count === 'number' && typeof p.total_count === 'number' && p.offset + p.count < p.total_count ? p.offset + p.count : null;
    return { items, nextOffset: next };
}

export function normalizePexels(json: any): { items: StockItem[]; nextPage: number | null } {
    const photos: any[] = Array.isArray(json?.photos) ? json.photos : [];
    const items: StockItem[] = [];
    for (const p of photos) {
        const full = p?.src?.large2x || p?.src?.large || p?.src?.original;
        const small = p?.src?.medium || p?.src?.small || full;
        if (!p?.id || !ok(full) || !ok(small)) continue;
        items.push({ id: String(p.id), title: String(p.alt || 'Foto'), url: full, preview: small, width: num(p.width, 1080), height: num(p.height, 1620), credit: p.photographer ? String(p.photographer) : undefined });
    }
    return { items, nextPage: typeof json?.next_page === 'string' && json.next_page ? (num(json.page, 1) + 1) : null };
}

export interface ClientMediaItem { url: string; name: string; kind: 'image' | 'video'; source: 'asset' | 'contenuto' }

const IMG = /\.(jpe?g|png|webp|gif)(\?|$)/i;
const VID = /\.(mp4|mov|m4v|webm)(\?|$)/i;

/**
 * I media che il cliente ha già: file caricati nella sua galleria e immagini/video dei suoi contenuti del PED
 * (compresi i lavori finiti dei task). Senza doppioni, i più recenti prima, solo https.
 */
export function collectClientMedia(assets: any[], contents: any[], limit = 120): ClientMediaItem[] {
    const out: ClientMediaItem[] = [];
    const seen = new Set<string>();
    const push = (url: unknown, name: string, source: ClientMediaItem['source'], mime?: string) => {
        if (typeof url !== 'string' || !/^https:\/\//i.test(url) || seen.has(url)) return;
        const probe = `${name} ${url}`;
        const kind: 'image' | 'video' | null = (mime || '').startsWith('video/') || VID.test(probe) ? 'video' : (mime || '').startsWith('image/') || IMG.test(probe) ? 'image' : null;
        if (!kind) return;
        seen.add(url);
        out.push({ url, name: name || 'File', kind, source });
    };
    for (const a of assets || []) push(a?.url || a?.downloadUrl || a?.fileUrl, String(a?.name || a?.filename || ''), 'asset', a?.type || a?.mimeType || a?.contentType);
    const recent = [...(contents || [])].sort((a, b) => String(b?.updatedAt || b?.createdAt || '').localeCompare(String(a?.updatedAt || a?.createdAt || '')));
    for (const c of recent) {
        for (const u of c?.imageUrls || []) push(u, String(c?.topic || ''), 'contenuto');
        push(c?.videoUrl, String(c?.topic || ''), 'contenuto');
        push(c?.coverUrl, String(c?.topic || ''), 'contenuto');
    }
    return out.slice(0, limit);
}
