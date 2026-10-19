// Indirizzi delle tre librerie pubbliche degli annunci già filtrati su un competitor, usando le PAGINE SALVATE per
// quel competitor (sito, Facebook, LinkedIn) invece del solo nome. Verificati nel browser il 19/10/2026: si aprono senza accesso.
import { facebookPageId, socialHandle } from './social-links';

export interface AdLibraryTarget { nome: string; sito?: string; facebook?: string; linkedin?: string }

/** "https://www.finiguerra.it/auto" → "finiguerra.it"; stringa vuota se non è un indirizzo. */
export function domainOf(site?: string): string {
    if (!site) return '';
    try {
        return new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

export type LibraryBasis = 'pagina' | 'sito' | 'nome profilo' | 'nome';

export function adLibraryLinks(target: AdLibraryTarget, country = 'IT') {
    const nome = target.nome.trim();
    const domain = domainOf(target.sito);
    const fbId = facebookPageId(target.facebook);
    const fbHandle = socialHandle(target.facebook);
    const inHandle = socialHandle(target.linkedin);
    const enc = encodeURIComponent;

    // Meta: con l'ID della pagina Facebook si aprono gli annunci di QUELLA pagina (nessun omonimo). Senza ID, il nome
    // del profilo salvato ("rivauto") è più distintivo del nome commerciale. La ricerca è comunque per parola chiave.
    const metaBase = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=${country}&is_targeted_country=false&media_type=all`;
    const metaSort = '&sort_data[mode]=total_impressions&sort_data[direction]=desc';
    const meta = fbId
        ? `${metaBase}&view_all_page_id=${fbId}&search_type=page${metaSort}`
        : `${metaBase}&q=${enc(fbHandle ?? nome)}&search_type=keyword_unordered${metaSort}`;

    const linkedinTerm = inHandle ? inHandle.replace(/[-_.]+/g, ' ') : nome;

    return {
        meta,
        // Google cerca per dominio (preciso) e, senza sito, per nome inserzionista.
        google: `https://adstransparency.google.com/?region=${country}${domain ? `&domain=${enc(domain)}` : `&query=${enc(nome)}`}`,
        linkedin: `https://www.linkedin.com/ad-library/search?keyword=${enc(linkedinTerm)}&countries=${country}`,
        /** Su cosa si basa ogni ricerca: lo si mostra, così si capisce quanto è affidabile. */
        basis: {
            meta: (fbId ? 'pagina' : fbHandle ? 'nome profilo' : 'nome') as LibraryBasis,
            google: (domain ? 'sito' : 'nome') as LibraryBasis,
            linkedin: (inHandle ? 'nome profilo' : 'nome') as LibraryBasis,
        },
    };
}
