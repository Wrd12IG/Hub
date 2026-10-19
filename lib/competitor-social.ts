/**
 * lib/competitor-social.ts
 *
 * Dati PUBBLICI dei profili social salvati per un competitor.
 *
 * Cosa si può leggere davvero, misurato il 19/10/2026:
 *  - YouTube: sì, con l'API ufficiale (chiave YOUTUBE_API_KEY): iscritti, visualizzazioni, video, ultimo caricamento.
 *  - LinkedIn: il numero di follower sta nella descrizione della pagina pubblica; LinkedIn però può rifiutare le
 *    richieste dai server, quindi è un tentativo: se non risponde lo si dice, non si inventa.
 *  - Instagram: solo tramite l'API ufficiale di Meta (Business Discovery), con il token di sistema dell'agenzia e l'account
 *    Instagram del cliente: funziona per i profili Business o Creator, non per quelli personali. Senza token o account
 *    resta un collegamento.
 *  - Facebook: la lettura dei numeri di una pagina altrui richiede un'autorizzazione dell'app Meta (Page Public Content
 *    Access): si tenta, e se manca lo si dice.
 *  - TikTok: nessuna API pubblica per i profili altrui. Resta un collegamento.
 */

import { resolvePublicChannel, getPublicVideos, type PublicChannel, type PublicVideo } from './youtube-public';
import { socialHandle, facebookPageId } from './social-links';

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

export interface InstagramStats {
    username: string;
    followers: number;
    posts: number;
    lastPost: string | null;
    /** Post negli ultimi 30 giorni fra gli ultimi letti (max 12: oltre, "12+"). */
    postsLast30d: number;
    postsCapped: boolean;
    /** Media di mi piace + commenti per post, sugli ultimi post letti; null se i mi piace sono nascosti. */
    avgInteractions: number | null;
    /** Interazioni medie per post in % dei follower. */
    engagementPct: number | null;
}

export interface FacebookStats { name: string; followers: number | null }

export interface SocialReading {
    competitorId: string;
    youtube?: YoutubeStats | { error: string };
    linkedin?: { followers: number } | { error: string };
    instagram?: InstagramStats | { error: string };
    facebook?: FacebookStats | { error: string };
    /** Profili salvati ma non leggibili da qui (TikTok sempre; Instagram e Facebook senza token Meta). */
    unreadable: ('instagram' | 'facebook' | 'tiktok')[];
}

/** Accesso a Meta: token di sistema dell'agenzia e id dell'account Instagram (Business) di cui ci si serve per leggere gli altri. */
export interface MetaAccess { token: string; instagramUserId?: string }

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

const GRAPH = 'https://graph.facebook.com/v21.0';

const noToken = (text: string, token: string) => text.split(token).join('').replace(/access_token=[^&\s"]+/gi, '');

/** Gli errori di Meta sono in inglese e criptici: si riscrivono in quello che c'è da fare. */
export function explainGraphError(err: { code?: number; message?: string; error_subcode?: number } | undefined, what: 'Instagram' | 'Facebook'): string {
    const code = err?.code;
    const msg = String(err?.message ?? '');
    if (code === 190) return 'Il token Meta è scaduto o non valido: va rigenerato in Vercel (META_SYSTEM_USER_TOKEN).';
    if (what === 'Instagram' && (code === 110 || /cannot find|not found|invalid user id|does not exist/i.test(msg))) {
        return 'Profilo non leggibile: deve essere un account Instagram Business o Creator (non personale) e il nome nel link deve essere esatto.';
    }
    if (code === 10 || code === 200 || /permission|capability|public content/i.test(msg)) {
        return what === 'Facebook'
            ? 'Meta non permette di leggere i numeri di pagine altrui senza l\'autorizzazione «Page Public Content Access» per l\'app: apri la pagina dal collegamento.'
            : 'Il token Meta non ha i permessi per leggere altri profili Instagram (servono instagram_basic e pages_read_engagement).';
    }
    if (code === 4 || code === 17 || code === 32 || code === 613) return 'Meta ha limitato le richieste: riprova fra qualche minuto.';
    return `${what}: Meta ha risposto con un errore (${code ?? 'sconosciuto'}).`;
}

/** La risposta di Business Discovery → numeri. Funzione pura: le chiamate di rete stanno sotto. */
export function parseInstagramDiscovery(json: any, now = new Date()): InstagramStats | { error: string } {
    const bd = json?.business_discovery;
    if (!bd || typeof bd.followers_count !== 'number') return { error: 'Instagram non ha restituito i dati del profilo.' };
    const since = now.getTime() - 30 * 86_400_000;
    const media: any[] = Array.isArray(bd.media?.data) ? bd.media.data : [];
    const dated = media.map((m) => ({ m, t: Date.parse(m.timestamp) })).filter((x) => Number.isFinite(x.t));
    const last = dated.slice().sort((a, b) => b.t - a.t)[0];
    // I mi piace nascosti arrivano senza like_count: se mancano non si inventa una media
    const withLikes = media.filter((m) => typeof m.like_count === 'number' && typeof m.comments_count === 'number');
    const avg = withLikes.length ? withLikes.reduce((s, m) => s + m.like_count + m.comments_count, 0) / withLikes.length : null;
    return {
        username: String(bd.username ?? ''),
        followers: bd.followers_count,
        posts: typeof bd.media_count === 'number' ? bd.media_count : 0,
        lastPost: last ? new Date(last.t).toISOString().slice(0, 10) : null,
        postsLast30d: dated.filter((x) => x.t >= since).length,
        postsCapped: media.length >= 12 && dated.every((x) => x.t >= since),
        avgInteractions: avg === null ? null : Math.round(avg),
        engagementPct: avg === null || bd.followers_count <= 0 ? null : Math.round((avg / bd.followers_count) * 10000) / 100,
    };
}

async function readInstagram(link: string, meta: MetaAccess): Promise<InstagramStats | { error: string }> {
    const handle = socialHandle(link);
    if (!handle || !meta.instagramUserId) return { error: 'Nome del profilo non riconosciuto nel link salvato.' };
    try {
        const fields = `business_discovery.username(${handle}){username,followers_count,media_count,media.limit(12){timestamp,like_count,comments_count}}`;
        const res = await fetch(`${GRAPH}/${meta.instagramUserId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(meta.token)}`, { signal: AbortSignal.timeout(10_000) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { error: explainGraphError(json?.error, 'Instagram') };
        return parseInstagramDiscovery(json);
    } catch (e: any) {
        return { error: noToken(`Instagram non raggiungibile: ${String(e.message).slice(0, 80)}`, meta.token) };
    }
}

async function readFacebook(link: string, meta: MetaAccess): Promise<FacebookStats | { error: string }> {
    const ref = facebookPageId(link) ?? socialHandle(link);
    if (!ref) return { error: 'Nome della pagina non riconosciuto nel link salvato.' };
    try {
        const res = await fetch(`${GRAPH}/${encodeURIComponent(ref)}?fields=name,followers_count,fan_count&access_token=${encodeURIComponent(meta.token)}`, { signal: AbortSignal.timeout(10_000) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { error: explainGraphError(json?.error, 'Facebook') };
        const followers = typeof json.followers_count === 'number' ? json.followers_count : typeof json.fan_count === 'number' ? json.fan_count : null;
        return { name: String(json.name ?? ref), followers };
    } catch (e: any) {
        return { error: noToken(`Facebook non raggiungibile: ${String(e.message).slice(0, 80)}`, meta.token) };
    }
}

export async function readCompetitorSocial(targets: SocialTarget[], meta?: MetaAccess): Promise<SocialReading[]> {
    return Promise.all(targets.map(async (t) => {
        const canInstagram = !!(meta?.token && meta.instagramUserId);
        const canFacebook = !!meta?.token;
        const [youtube, linkedin, instagram, facebook] = await Promise.all([
            t.youtube ? readYoutube(t.youtube) : undefined,
            t.linkedin ? readLinkedin(t.linkedin) : undefined,
            t.instagram && canInstagram ? readInstagram(t.instagram, meta!) : undefined,
            t.facebook && canFacebook ? readFacebook(t.facebook, meta!) : undefined,
        ]);
        const unreadable = (['instagram', 'facebook', 'tiktok'] as const).filter((k) => !!t[k] && !(k === 'instagram' && canInstagram) && !(k === 'facebook' && canFacebook));
        return { competitorId: t.id, ...(youtube ? { youtube } : {}), ...(linkedin ? { linkedin } : {}), ...(instagram ? { instagram } : {}), ...(facebook ? { facebook } : {}), unreadable };
    }));
}
