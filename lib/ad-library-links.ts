// Indirizzi delle tre librerie pubbliche degli annunci già filtrati su un competitor.
// Verificati nel browser il 19/10/2026: tutte e tre si aprono senza accesso.

export interface AdLibraryTarget { nome: string; sito?: string }

/** "https://www.finiguerra.it/auto" → "finiguerra.it"; stringa vuota se non è un indirizzo. */
export function domainOf(site?: string): string {
    if (!site) return '';
    try {
        return new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

export function adLibraryLinks(target: AdLibraryTarget, country = 'IT') {
    const q = encodeURIComponent(target.nome.trim());
    const domain = domainOf(target.sito);
    return {
        // Parola chiave: Meta non cerca per dominio, quindi il nome può dare anche omonimi: va letto il nome dell'inserzionista.
        meta: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&is_targeted_country=false&media_type=all&q=${q}&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc`,
        // Google cerca per dominio (preciso) e, senza sito, per nome inserzionista.
        google: `https://adstransparency.google.com/?region=${country}${domain ? `&domain=${encodeURIComponent(domain)}` : `&query=${q}`}`,
        linkedin: `https://www.linkedin.com/ad-library/search?keyword=${q}&countries=${country}`,
    };
}
