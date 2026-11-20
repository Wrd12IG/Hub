import type { Finding } from './types';
import { monthYear } from './text';

export interface SitemapInfo {
    urls: Array<{ loc: string; lastmod?: Date }>;
    /** Se è un indice di sitemap: gli indirizzi delle sitemap figlie. */
    sitemaps: string[];
    newest?: Date;
}

const MAX_XML = 5_000_000;
const MAX_URLS = 50_000;
const unwrap = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').trim();

/** Legge una sitemap (o un indice di sitemap). Un file che non lo è dà un risultato vuoto, mai un errore. */
export function parseSitemap(xml: string): SitemapInfo {
    const text = (xml || '').slice(0, MAX_XML);
    const info: SitemapInfo = { urls: [], sitemaps: [] };

    for (const m of Array.from(text.matchAll(/<sitemap\b[^>]*>([\s\S]*?)<\/sitemap>/gi))) {
        const loc = m[1].match(/<loc[^>]*>([\s\S]*?)<\/loc>/i)?.[1];
        if (loc && info.sitemaps.length < 200) info.sitemaps.push(unwrap(loc));
    }
    for (const m of Array.from(text.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/gi))) {
        if (info.urls.length >= MAX_URLS) break;
        const loc = m[1].match(/<loc[^>]*>([\s\S]*?)<\/loc>/i)?.[1];
        if (!loc) continue;
        const raw = m[1].match(/<lastmod[^>]*>([\s\S]*?)<\/lastmod>/i)?.[1];
        const when = raw ? new Date(unwrap(raw)) : undefined;
        const lastmod = when && !Number.isNaN(when.getTime()) ? when : undefined;
        info.urls.push({ loc: unwrap(loc), lastmod });
        if (lastmod && (!info.newest || lastmod > info.newest)) info.newest = lastmod;
    }
    return info;
}

/** La sitemap che non si aggiorna da molto: la data più recente tra tutte le pagine. Senza date non si giudica. */
export function staleSitemapFinding(info: SitemapInfo, sitemapUrl: string, now: Date): Finding | null {
    if (!info.newest) return null;
    const months = (now.getUTCFullYear() - info.newest.getUTCFullYear()) * 12 + (now.getUTCMonth() - info.newest.getUTCMonth());
    if (months < 18) return null;
    return {
        type: 'stale_sitemap',
        severity: months >= 36 ? 'media' : 'bassa',
        url: sitemapUrl,
        key: 'sitemap',
        evidence: `Ultimo aggiornamento nella sitemap: ${monthYear(info.newest)} (${info.urls.length} pagine)`,
        confidence: 'alta',
    };
}
