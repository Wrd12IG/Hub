import type { Finding, ImageRef } from './types';

const MAX_IMAGES = 200;
const MAX_LINKS = 300;
const ATTR = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

function attrs(tag: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const m of Array.from(tag.matchAll(ATTR))) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
    return out;
}

function stripHidden(html: string): string {
    return html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ');
}

function resolveHttp(raw: string, base: string): string | null {
    try {
        const u = new URL(raw.trim().replace(/&amp;/g, '&'), base);
        return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
    } catch {
        return null;
    }
}

/**
 * Le immagini di una pagina, con indirizzo assoluto e testo alternativo. Si leggono anche quelle caricate in differita
 * (data-src, srcset). Si saltano: dati incorporati (data:), pixel di tracciamento 1x1, doppioni, e ciò che sta nei commenti o in <noscript>.
 */
export function extractImages(html: string, baseUrl: string): ImageRef[] {
    const out: ImageRef[] = [];
    const seen = new Set<string>();
    for (const m of Array.from(stripHidden(html).matchAll(/<img\b[^>]*>/gi))) {
        const a = attrs(m[0]);
        const first = (v?: string) => v?.split(',')[0]?.trim().split(/\s+/)[0];
        const raw = a['src'] || a['data-src'] || a['data-lazy-src'] || first(a['srcset']) || first(a['data-srcset']);
        if (!raw || raw.startsWith('data:')) continue;
        if (a['width'] === '1' || a['height'] === '1') continue;
        const src = resolveHttp(raw, baseUrl);
        if (!src || seen.has(src)) continue;
        seen.add(src);
        out.push({ src, alt: 'alt' in a ? a['alt'] : null });
        if (out.length >= MAX_IMAGES) break;
    }
    return out;
}

/** I link di una pagina, assoluti e senza ancora. Non si seguono mailto, tel, javascript. */
export function extractLinks(html: string, baseUrl: string): string[] {
    const out = new Set<string>();
    for (const m of Array.from(stripHidden(html).matchAll(/<a\b[^>]*>/gi))) {
        const href = attrs(m[0])['href'];
        if (!href || /^(?:#|mailto:|tel:|javascript:)/i.test(href.trim())) continue;
        const abs = resolveHttp(href, baseUrl);
        if (!abs) continue;
        const u = new URL(abs);
        u.hash = '';
        out.add(u.href);
        if (out.size >= MAX_LINKS) break;
    }
    return Array.from(out);
}

const MAX_ALT_PER_PAGE = 20;

/** Solo l'attributo alt MANCANTE: alt="" è una scelta voluta per le immagini decorative e va bene. */
export function imageAltFindings(images: ImageRef[], pageUrl: string): Finding[] {
    return images
        .filter((i) => i.alt === null)
        .slice(0, MAX_ALT_PER_PAGE)
        .map((i) => ({
            type: 'image_no_alt' as const,
            severity: 'bassa' as const,
            url: pageUrl,
            key: i.src,
            evidence: `Immagine senza testo alternativo: ${new URL(i.src).pathname}`,
            confidence: 'alta' as const,
        }));
}
