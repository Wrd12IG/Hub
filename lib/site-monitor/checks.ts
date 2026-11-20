import type { Finding, UrlCheck } from './types';

export const HEAVY_IMAGE_BYTES = 500_000;
const MAX_HOPS = 2;
// Siti esterni che rifiutano i controlli automatici: non significa che il link sia rotto.
const BLOCKS_BOTS = new Set([401, 403, 405, 429, 999]);

/** Una pagina del sito che non risponde come dovrebbe. 404, 410 e errori del server sono i più gravi. */
export function classifyPageCheck(page: { url: string; status: number; error?: string }): Finding | null {
    if (page.error) {
        return { type: 'http_error', severity: 'media', url: page.url, key: 'page', evidence: `Il sito non risponde (${page.error})`, confidence: 'bassa' };
    }
    if (page.status < 400) return null;
    const gone = page.status === 404 || page.status === 410 || page.status >= 500;
    return { type: 'http_error', severity: gone ? 'alta' : 'media', url: page.url, key: 'page', evidence: `La pagina risponde ${page.status}`, confidence: 'alta' };
}

/** Un link della pagina `fromUrl`. Un link esterno si segnala solo se la pagina non esiste davvero (404, 410, errore del server). */
export function classifyLinkCheck(check: UrlCheck, fromUrl: string, internal: boolean): Finding[] {
    const out: Finding[] = [];
    if (check.error) {
        // Un timeout può essere passeggero: segnalato con poca fiducia, e solo per i link interni.
        if (internal) out.push({ type: 'broken_link', severity: 'bassa', url: fromUrl, key: check.url, evidence: `Link non raggiungibile: ${check.url} (${check.error})`, confidence: 'bassa' });
        return out;
    }
    const broken = internal
        ? check.status >= 400 && !BLOCKS_BOTS.has(check.status)
        : check.status === 404 || check.status === 410 || check.status >= 500;
    if (broken) {
        out.push({ type: 'broken_link', severity: internal ? 'media' : 'bassa', url: fromUrl, key: check.url, evidence: `Link rotto (${check.status}): ${check.url}`, confidence: 'alta' });
    } else if ((check.hops ?? 0) > MAX_HOPS && check.status < 400) {
        out.push({ type: 'redirect_chain', severity: 'bassa', url: fromUrl, key: check.url, evidence: `Il link passa da ${check.hops} rimandi: ${check.url}`, confidence: 'alta' });
    }
    return out;
}

const mb = (bytes: number) => `${(bytes / 1_000_000).toFixed(1).replace('.', ',')} MB`;

export function classifyImageCheck(check: UrlCheck, pageUrl: string): Finding[] {
    if (check.error) return [];            // un errore di rete su un'immagine non si segnala: troppo spesso è passeggero
    if (check.status >= 400 && !BLOCKS_BOTS.has(check.status)) {
        return [{ type: 'image_broken', severity: 'media', url: pageUrl, key: check.url, evidence: `Immagine che non si carica (${check.status}): ${check.url}`, confidence: 'alta' }];
    }
    if (check.status < 400 && (check.bytes ?? 0) > HEAVY_IMAGE_BYTES) {
        return [{ type: 'image_heavy', severity: 'bassa', url: pageUrl, key: check.url, evidence: `Immagine di ${mb(check.bytes!)}: ${check.url}`, confidence: 'alta' }];
    }
    return [];
}
