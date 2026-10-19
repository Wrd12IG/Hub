/**
 * lib/competitor-social.ts
 *
 * Dati PUBBLICI dei profili social salvati per un competitor.
 *
 * Cosa si può leggere davvero, misurato il 19/10/2026:
 *  - YouTube: sì, con l'API ufficiale (chiave YOUTUBE_API_KEY): iscritti, visualizzazioni, video, ultimo caricamento.
 *  - LinkedIn: il numero di follower sta nella descrizione della pagina pubblica; LinkedIn però può rifiutare le
 *    richieste dai server, quindi è un tentativo: se non risponde lo si dice, non si inventa.
 *  - Instagram, Facebook, TikTok: chiedono l'accesso (o un'integrazione approvata) anche per la pagina di un profilo
 *    pubblico. Da un server non esce nessun numero: restano come collegamenti.
 */

import { resolvePublicChannel, getPublicVideos, type PublicChannel, type PublicVideo } from './youtube-public';

export interface YoutubeStats {
    title: string;
    url?: string;
    /** null quando il canale nasconde il numero degli iscritti. */
    subscribers: number | null;
    views: number;
    videos: number;
    lastUpload: string | null;
    /** Caricamenti negli ultimi 30 giorni, fra gli ultimi video letti (max 15: oltre, "15+"). */
    uploadsLast30d: number;
    uploadsCapped: boolean;
}

export interface SocialReading {
    competitorId: string;
    youtube?: YoutubeStats | { error: string };
    linkedin?: { followers: number } | { error: string };
    /** Profili salvati ma non leggibili da un server (Instagram, Facebook, TikTok). */
    unreadable: ('instagram' | 'facebook' | 'tiktok')[];
}

export interface SocialTarget {
    id: string;
    instagram?: string; facebook?: string; linkedin?: string; youtube?: string; tiktok?: string;
}

/** "142,628" / "142.628" / "980" → numero; null per tutto il resto (non si indovina "1,2 K"). */
export function parseCount(text: string): number | null {
    const t = text.trim();
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return parseInt(t.replace(/[.,]/g, ''), 10);
    return null;
}

/** I follower dalla descrizione di una pagina LinkedIn ("Nome | 142,628 followers on LinkedIn. …" / "142.628 follower"). */
export function parseLinkedinFollowers(html: string): number | null {
    const desc = html.match(/property="og:description"\s+content="([^"]*)"/i)?.[1]
        ?? html.match(/content="([^"]*)"\s+property="og:description"/i)?.[1]
        ?? html.match(/name="description"\s+content="([^"]*)"/i)?.[1]
        ?? '';
    const m = desc.match(/([\d.,]+)\s+(?:followers?|follower)\b/i);
    return m ? parseCount(m[1]) : null;
}

export function summarizeYoutube(channel: PublicChannel, videos: PublicVideo[], now = new Date(), url?: string): YoutubeStats {
    const since = now.getTime() - 30 * 86_400_000;
    const dated = videos.map((v) => ({ v, t: Date.parse(v.date) })).filter((x) => Number.isFinite(x.t));
    const last = dated.sort((a, b) => b.t - a.t)[0];
    return {
        title: channel.title,
        url,
        subscribers: channel.hiddenSubscribers ? null : channel.subscribers,
        views: channel.views,
        videos: channel.videos,
        lastUpload: last ? new Date(last.t).toISOString().slice(0, 10) : null,
        uploadsLast30d: dated.filter((x) => x.t >= since).length,
        // Se tutti i video letti sono dell'ultimo mese, ce ne potrebbero essere altri
        uploadsCapped: videos.length >= 15 && dated.every((x) => x.t >= since),
    };
}

async function readYoutube(link: string): Promise<YoutubeStats | { error: string }> {
    try {
        const channel = await resolvePublicChannel(link);
        if (!channel) return { error: 'Indirizzo non riconosciuto: usa il link con @nome o quello del canale.' };
        const videos = channel.uploadsPlaylistId ? await getPublicVideos(channel.uploadsPlaylistId, 15).catch(() => []) : [];
        return summarizeYoutube(channel, videos, new Date(), link);
    } catch (e: any) {
        return { error: String(e.message).replace(/key=[^&\s]+/gi, '').slice(0, 140) };
    }
}

async function readLinkedin(link: string): Promise<{ followers: number } | { error: string }> {
    try {
        const res = await fetch(link, {
            headers: { 'user-agent': 'Mozilla/5.0 (compatible; WRDigitalHub/1.0; +https://hub.wrdigital.it)', 'accept-language': 'it-IT,it;q=0.9,en;q=0.8' },
            signal: AbortSignal.timeout(8_000),
            next: { revalidate: 3600 },
        });
        if (!res.ok) return { error: `LinkedIn non risponde alle letture automatiche (HTTP ${res.status}): apri la pagina dal collegamento.` };
        const followers = parseLinkedinFollowers(await res.text());
        return followers === null ? { error: 'Il numero di follower non compare nella pagina pubblica.' } : { followers };
    } catch (e: any) {
        return { error: `Pagina LinkedIn non raggiungibile: ${String(e.message).slice(0, 80)}` };
    }
}

export async function readCompetitorSocial(targets: SocialTarget[]): Promise<SocialReading[]> {
    return Promise.all(targets.map(async (t) => {
        const [youtube, linkedin] = await Promise.all([
            t.youtube ? readYoutube(t.youtube) : undefined,
            t.linkedin ? readLinkedin(t.linkedin) : undefined,
        ]);
        const unreadable = (['instagram', 'facebook', 'tiktok'] as const).filter((k) => !!t[k]);
        return { competitorId: t.id, ...(youtube ? { youtube } : {}), ...(linkedin ? { linkedin } : {}), unreadable };
    }));
}
