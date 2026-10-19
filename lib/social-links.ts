// Collegamenti ai profili social di un competitor. Lo staff li scrive come capita ("@nome", "instagram.com/nome",
// un indirizzo intero): qui diventano sempre un indirizzo https utilizzabile, oppure niente. Solo http/https: una
// stringa come "javascript:..." non deve mai diventare il link di un pulsante.

export type SocialKey = 'instagram' | 'facebook' | 'linkedin' | 'youtube' | 'tiktok';

export const SOCIAL_KEYS: SocialKey[] = ['instagram', 'facebook', 'linkedin', 'youtube', 'tiktok'];

const BASE: Record<SocialKey, (handle: string) => string> = {
    instagram: (h) => `https://www.instagram.com/${h}`,
    facebook: (h) => `https://www.facebook.com/${h}`,
    linkedin: (h) => `https://www.linkedin.com/company/${h}`,
    // Un id canale (UC + 22 caratteri) vuole /channel/, il resto è un @nome
    youtube: (h) => (/^UC[\w-]{22}$/.test(h) ? `https://www.youtube.com/channel/${h}` : `https://www.youtube.com/@${h}`),
    tiktok: (h) => `https://www.tiktok.com/@${h}`,
};

const SOCIAL_HOSTS = /^(www\.)?(instagram\.com|facebook\.com|fb\.com|linkedin\.com|youtube\.com|youtu\.be|tiktok\.com)(\/|$)/i;

/** "instagram.com/x", "www.sito.it", "sito.it/pagina": un indirizzo senza https. "spotorno.car" invece è un nome utente valido. */
const looksLikeAddress = (v: string) => SOCIAL_HOSTS.test(v) || /^www\./i.test(v) || /^[\w-]+(\.[\w-]+)+\//.test(v);

export function normalizeSocial(platform: SocialKey, raw?: string | null): string | undefined {
    const value = (raw ?? '').trim();
    if (!value) return undefined;

    // Indirizzo completo, o con il dominio ma senza https ("instagram.com/nome")
    const asUrl = /^https?:\/\//i.test(value) ? value : looksLikeAddress(value) ? `https://${value}` : null;
    if (asUrl) {
        try {
            const u = new URL(asUrl);
            return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : undefined;
        } catch {
            return undefined;
        }
    }

    // Altrimenti è un nome utente: via la chiocciola e gli spazi attorno, solo caratteri validi nei nomi dei profili
    const handle = value.replace(/^@+/, '').trim();
    if (!/^[\w.-]{2,60}$/.test(handle)) return undefined;
    return BASE[platform](handle);
}
