// YouTube in sola lettura dei dati PUBBLICI: bastano l'ID del canale e una chiave API (YOUTUBE_API_KEY, limitata a
// YouTube Data API v3). Nessun token OAuth, nessun ruolo sul canale. Non fornisce le metriche private di YouTube
// Analytics (tempo di visione, iscritti guadagnati/persi, demografiche): quelle richiedono l'autorizzazione del proprietario.

const YT = 'https://www.googleapis.com/youtube/v3';
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

export interface PublicChannel {
    id: string;
    title: string;
    customUrl?: string;
    subscribers: number;
    views: number;
    videos: number;
    hiddenSubscribers: boolean;
    uploadsPlaylistId?: string;
}

export interface PublicVideo {
    id: string;
    title: string;
    date: string;
    thumbnail: string;
    url: string;
    views: number;
    likes: number;
    comments: number;
    duration: string;
}

/**
 * Accetta un ID canale (UC...), un link youtube.com/channel/UC... oppure un @handle / link youtube.com/@handle.
 * Restituisce { channelId } o { handle }: l'handle va poi risolto con l'API.
 */
export function parseChannelInput(input: string): { channelId?: string; handle?: string } | null {
    const text = (input || '').trim();
    if (!text) return null;
    if (CHANNEL_ID_RE.test(text)) return { channelId: text };

    const fromUrl = text.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/i);
    if (fromUrl) return { channelId: fromUrl[1] };

    const handle = text.match(/(?:youtube\.com\/)?@([A-Za-z0-9._-]{3,})/i);
    if (handle) return { handle: `@${handle[1]}` };
    return null;
}

function apiKey(): string {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) throw new Error('YOUTUBE_API_KEY non configurata');
    return key;
}

async function ytGet<T = any>(path: string, params: Record<string, string>): Promise<T> {
    const url = `${YT}${path}?${new URLSearchParams({ ...params, key: apiKey() })}`;
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // La chiave NON compare mai nel messaggio
        throw new Error(`YouTube API ${res.status}: ${body?.error?.message || res.statusText}`);
    }
    return res.json() as Promise<T>;
}

export function channelFromItem(item: any): PublicChannel | null {
    if (!item?.id) return null;
    const stats = item.statistics || {};
    return {
        id: item.id,
        title: item.snippet?.title || '',
        customUrl: item.snippet?.customUrl,
        // Le statistiche tornano come stringhe: cast difensivo
        subscribers: Number(stats.subscriberCount ?? 0),
        views: Number(stats.viewCount ?? 0),
        videos: Number(stats.videoCount ?? 0),
        hiddenSubscribers: !!stats.hiddenSubscriberCount,
        uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads,
    };
}

/** Legge il canale da ID o @handle. Null se non esiste. */
export async function resolvePublicChannel(input: string): Promise<PublicChannel | null> {
    const parsed = parseChannelInput(input);
    if (!parsed) return null;
    const base = { part: 'snippet,statistics,contentDetails' };
    const data = await ytGet(
        '/channels',
        parsed.channelId ? { ...base, id: parsed.channelId } : { ...base, forHandle: parsed.handle! },
    );
    return channelFromItem(data.items?.[0]);
}

export function videoFromItem(v: any): PublicVideo {
    const s = v.statistics || {};
    return {
        id: v.id,
        title: v.snippet?.title || '',
        date: String(v.snippet?.publishedAt || '').split('T')[0],
        thumbnail: v.snippet?.thumbnails?.medium?.url || '',
        url: `https://youtube.com/watch?v=${v.id}`,
        views: Number(s.viewCount ?? 0),
        likes: Number(s.likeCount ?? 0),
        comments: Number(s.commentCount ?? 0),
        duration: v.contentDetails?.duration || '',
    };
}

/** Ultimi video del canale con le statistiche pubbliche (max 50, un solo giro di lettura). */
export async function getPublicVideos(uploadsPlaylistId: string, maxResults = 20): Promise<PublicVideo[]> {
    const list = await ytGet('/playlistItems', {
        part: 'contentDetails', playlistId: uploadsPlaylistId, maxResults: String(Math.min(maxResults, 50)),
    });
    const ids = (list.items || []).map((i: any) => i.contentDetails?.videoId).filter(Boolean);
    if (ids.length === 0) return [];
    const details = await ytGet('/videos', { part: 'snippet,statistics,contentDetails', id: ids.join(',') });
    return (details.items || []).map(videoFromItem);
}
