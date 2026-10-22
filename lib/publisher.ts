/**
 * lib/publisher.ts
 *
 * Logica pura della pubblicazione programmata: quando un contenuto è "da pubblicare" e quale azione Windsor
 * corrisponde a ciascun canale. Nessun I/O, così si testa senza rete (vedi lib/__tests__/publisher.test.ts).
 * La route che la usa è app/api/cron/publish-scheduled.
 *
 * ⚠️ Le azioni di scrittura pubblicano DAVVERO sui profili dei clienti. Gli schemi sono quelli restituiti da
 * `list_actions` di Windsor (22/10/2026): non aggiungere un parametro che lo schema non elenca, Windsor rifiuta
 * (additionalProperties: false).
 */
import type { Client, EditorialContent, PublishChannel } from '@/lib/data';
import type { WindsorConnector } from '@/lib/windsor-client';
import { composePostText } from '@/lib/post-text';

/** Canali che sappiamo pubblicare. TikTok e YouTube no: Windsor non li supporta, servono le API dirette. */
export const AUTOMATED_CHANNELS: PublishChannel[] = ['facebook', 'instagram', 'igStories', 'linkedin', 'gbp'];
export const UNSUPPORTED_CHANNELS: PublishChannel[] = ['tiktok', 'youtube', 'fbStories'];

/** Un contenuto con la sola data (senza orario) esce a quest'ora, fuso Europe/Rome. */
export const DEFAULT_PUBLISH_HOUR = 9;
export const MAX_ATTEMPTS = 3;
/** Un canale rimasto "in pubblicazione" oltre questo tempo ha perso la risposta: NON si riprova da soli (rischio doppio post). */
export const STALE_PUBLISHING_MS = 15 * 60 * 1000;

/** Offset in ms di Europe/Rome rispetto a UTC nell'istante dato (ora legale compresa). */
function romeOffsetMs(at: Date): number {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Rome', hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * L'istante in cui il contenuto va pubblicato, o null se la data manca o non si legge.
 * "2026-10-25" (solo data) → quel giorno alle 09:00 di Roma; una data con orario si prende com'è.
 */
export function scheduledInstant(publicationDate?: string): Date | null {
    if (!publicationDate) return null;
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(publicationDate.trim());
    if (dateOnly) {
        const [, y, m, d] = dateOnly.map(Number) as unknown as number[];
        const guess = new Date(Date.UTC(y, m - 1, d, DEFAULT_PUBLISH_HOUR, 0, 0));
        return new Date(guess.getTime() - romeOffsetMs(guess));
    }
    const parsed = new Date(publicationDate);
    return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Oltre questo ritardo un contenuto approvato NON esce da solo: un post di mesi fa approvato per sbaglio (o rimasto
 * indietro) non deve comparire oggi sul profilo di un cliente. Lo si ripianifica a mano.
 */
export const MAX_OVERDUE_MS = 3 * 24 * 60 * 60 * 1000;

export type DueState = 'due' | 'not-yet' | 'too-late' | 'no-date' | 'not-approved';

export function dueState(content: Pick<EditorialContent, 'status' | 'publicationDate'>, now: Date): DueState {
    if (content.status !== 'Approvato') return 'not-approved';
    const at = scheduledInstant(content.publicationDate);
    if (!at) return 'no-date';
    const late = now.getTime() - at.getTime();
    if (late < 0) return 'not-yet';
    return late > MAX_OVERDUE_MS ? 'too-late' : 'due';
}

export function isDue(content: Pick<EditorialContent, 'status' | 'publicationDate'>, now: Date): boolean {
    return dueState(content, now) === 'due';
}

/** I canali richiesti dal contenuto (le spunte della tabella). */
export function requestedChannels(content: EditorialContent): PublishChannel[] {
    return ([...AUTOMATED_CHANNELS, ...UNSUPPORTED_CHANNELS] as PublishChannel[]).filter((c) => !!content[c]);
}

export interface PlannedAction {
    connector: WindsorConnector;
    action: string;
    accountId: string;
    params: Record<string, unknown>;
    /** Identifica l'azione dentro il canale (più azioni sullo stesso account, per esempio più storie): serve a non rifarla. */
    key?: string;
}
export type PlanResult = { actions: PlannedAction[] } | { error: string };

const INSTAGRAM_CAPTION_MAX = 2200;
const LINKEDIN_MAX = 3000;
const GBP_MAX = 1500;

/** Testo del post: didascalia, @menzioni e #hashtag (lib/post-text.ts), nei limiti del canale. */
function postText(content: EditorialContent, max: number): string {
    return composePostText(content.copy, content.tags, content.mentions, max);
}

function isHttps(url: string | undefined): url is string {
    return !!url && /^https:\/\//i.test(url);
}

/** Traduce (contenuto, canale, cliente) nella/e chiamata/e Windsor, oppure spiega perché non si può. */
export function planChannel(content: EditorialContent, channel: PublishChannel, client: Pick<Client, 'windsorAccounts'>): PlanResult {
    const accounts = client.windsorAccounts || {};
    const images = (content.imageUrls || []).filter(isHttps);
    const video = isHttps(content.videoUrl) ? content.videoUrl : undefined;

    switch (channel) {
        case 'instagram': {
            if (!accounts.instagram) return { error: 'Account Instagram non collegato in Setup API' };
            const caption = postText(content, INSTAGRAM_CAPTION_MAX);
            if (video) {
                // Lo schema di Windsor accetta cover_url oppure thumb_offset, mai tutti e due: senza copertina Instagram usa il primo fotogramma.
                const cover = isHttps(content.coverUrl) ? content.coverUrl : undefined;
                return { actions: [{ connector: 'instagram', action: 'create_video_post', accountId: accounts.instagram, params: { video_url: video, caption, ...(cover ? { cover_url: cover } : {}) } }] };
            }
            if (images.length >= 2) return { actions: [{ connector: 'instagram', action: 'create_carousel_post', accountId: accounts.instagram, params: { image_urls: images.slice(0, 10), caption } }] };
            if (images.length === 1) return { actions: [{ connector: 'instagram', action: 'create_image_post', accountId: accounts.instagram, params: { image_url: images[0], caption } }] };
            return { error: 'Instagram richiede almeno un\'immagine o un video (URL https)' };
        }
        case 'igStories': {
            if (!accounts.instagram) return { error: 'Account Instagram non collegato in Setup API' };
            if (video) return { actions: [{ connector: 'instagram', action: 'create_story', accountId: accounts.instagram, key: `${accounts.instagram}#video`, params: { video_url: video } }] };
            // Ogni immagine è una storia (le slide dell'editor), pubblicate in ordine. Instagram non le raggruppa.
            if (images.length >= 1) {
                return { actions: images.slice(0, 10).map((url, i) => ({ connector: 'instagram' as const, action: 'create_story', accountId: accounts.instagram!, key: `${accounts.instagram}#${i}`, params: { image_url: url } })) };
            }
            return { error: 'La storia richiede un\'immagine o un video (URL https)' };
        }
        case 'facebook': {
            if (!accounts.facebook_page) return { error: 'Pagina Facebook non collegata in Setup API' };
            const message = postText(content, 63206);
            if (images.length >= 1) return { actions: [{ connector: 'facebook_organic', action: 'create_photo_post', accountId: accounts.facebook_page, params: { image_url: images[0], caption: message } }] };
            if (video) return { error: 'Facebook: i video non sono ancora automatizzati (solo testo e foto singola)' };
            if (!message) return { error: 'Facebook richiede un testo o un\'immagine' };
            return { actions: [{ connector: 'facebook_organic', action: 'create_post', accountId: accounts.facebook_page, params: { message } }] };
        }
        case 'linkedin': {
            if (!accounts.linkedin_organic) return { error: 'Pagina LinkedIn non collegata in Setup API' };
            const commentary = postText(content, LINKEDIN_MAX);
            if (images.length >= 1) return { actions: [{ connector: 'linkedin_organic', action: 'create_image_post', accountId: accounts.linkedin_organic, params: { image_url: images[0], commentary } }] };
            if (video) return { error: 'LinkedIn: i video non sono ancora automatizzati (solo testo e immagine singola)' };
            if (!commentary) return { error: 'LinkedIn richiede un testo o un\'immagine' };
            return { actions: [{ connector: 'linkedin_organic', action: 'create_post', accountId: accounts.linkedin_organic, params: { commentary } }] };
        }
        case 'gbp': {
            const sedi = accounts.gbp || [];
            if (sedi.length === 0) return { error: 'Nessuna sede GBP collegata in Setup API' };
            const summary = postText(content, GBP_MAX);
            if (!summary) return { error: 'GBP richiede un testo' };
            const params: Record<string, unknown> = { summary, language_code: 'it' };
            if (images.length >= 1) params.photo_url = images[0];
            return { actions: sedi.map((accountId) => ({ connector: 'google_my_business' as const, action: 'create_local_post', accountId, params })) };
        }
        default:
            return { error: 'Canale non ancora automatizzato (servono le API dirette della piattaforma)' };
    }
}

/** Id e link del post dalla risposta di Windsor, che non ha una forma documentata: si cerca con tolleranza. */
export function extractPostRef(response: unknown): { postId?: string; postUrl?: string } {
    const found: { postId?: string; postUrl?: string } = {};
    const visit = (node: unknown, depth: number) => {
        if (!node || typeof node !== 'object' || depth > 4) return;
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
            if (!found.postId && /^(post_id|media_id|id|urn|name)$/i.test(k) && (typeof v === 'string' || typeof v === 'number')) found.postId = String(v);
            else if (!found.postUrl && /^(permalink|post_url|url|search_url)$/i.test(k) && typeof v === 'string' && /^https?:\/\//.test(v)) found.postUrl = v;
            else if (typeof v === 'object') visit(v, depth + 1);
        }
    };
    visit(response, 0);
    return found;
}

/** Il contenuto è "Pubblicato" quando ogni canale automatizzato richiesto è andato; quelli non automatizzati non bloccano. */
export function allAutomatedPublished(content: Pick<EditorialContent, 'publishResults'> & Partial<EditorialContent>, requested: PublishChannel[]): boolean {
    const automated = requested.filter((c) => AUTOMATED_CHANNELS.includes(c));
    if (automated.length === 0) return false;
    return automated.every((c) => content.publishResults?.[c]?.status === 'published');
}
