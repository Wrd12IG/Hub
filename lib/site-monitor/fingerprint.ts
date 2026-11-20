import { createHash } from 'crypto';
import type { Finding } from './types';

const VOLATILE_PARAMS = /^(?:utm_[a-z]+|gclid|fbclid|msclkid|mc_cid|mc_eid|ref|_ga|_gl)$/i;

/**
 * L'indirizzo in forma unica, per riconoscere lo stesso problema alla scansione dopo: protocollo e dominio in minuscolo, senza «www.»,
 * senza ancora, senza parametri di tracciamento, senza porta di default e senza barra finale. Un rimando da www a non-www non deve far
 * nascere problemi nuovi.
 */
export function canonicalUrl(raw: string): string {
    try {
        const u = new URL(raw);
        u.hash = '';
        u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
        for (const key of Array.from(u.searchParams.keys())) if (VOLATILE_PARAMS.test(key)) u.searchParams.delete(key);
        u.searchParams.sort();
        const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, '') : '/';
        const port = u.port && !((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) ? `:${u.port}` : '';
        const query = u.searchParams.toString();
        return `${u.protocol}//${u.hostname}${port}${path}${query ? `?${query}` : ''}`;
    } catch {
        return raw.trim().toLowerCase();
    }
}

const SITE_WIDE = new Set(['stale_copyright', 'stale_sitemap']);

/**
 * L'impronta di un problema: tipo + pagina + ciò che lo identifica. Lo stesso problema nella scansione dopo ha la stessa impronta, quindi
 * si aggiorna il finding e non si crea un secondo task. I problemi di tutto il sito (copyright, sitemap) si legano al dominio, non alla pagina.
 */
export function fingerprint(f: Pick<Finding, 'type' | 'url' | 'key'>): string {
    const where = SITE_WIDE.has(f.type) ? new URL(canonicalUrl(f.url)).host : canonicalUrl(f.url);
    const key = f.key.toLowerCase().replace(/\s+/g, ' ').trim();
    return createHash('sha1').update(`${f.type}|${where}|${key}`).digest('hex');
}
