import type { Finding } from './types';

const COPYRIGHT = /(?:©|\(c\)|copyright)\s*(?:(?:19|20)\d{2}\s*[-–—]\s*)?((?:19|20)\d{2})(?!\d)/gi;

/**
 * L'anno nel copyright fermo a un anno fa o più. Tra più anni (il sito e il credito di un tema) conta il più recente: meno segnalazioni a
 * vuoto, e il limite è che un tema aggiornato può nascondere un sito fermo. Un anno di ritardo è un problema lieve, tre sono da sistemare.
 */
export function findStaleCopyright(text: string, now: Date, url: string): Finding | null {
    const currentYear = now.getUTCFullYear();
    let latest = 0;
    let at = 0;
    for (const m of Array.from(text.matchAll(COPYRIGHT))) {
        const y = Number(m[1]);
        if (y > latest && y <= currentYear + 1) {
            latest = y;
            at = m.index!;
        }
    }
    if (!latest || latest >= currentYear) return null;
    const gap = currentYear - latest;
    return {
        type: 'stale_copyright',
        severity: gap >= 3 ? 'media' : 'bassa',
        url,
        key: 'copyright',
        evidence: text.slice(Math.max(0, at - 10), at + 60).replace(/\s+/g, ' ').trim().slice(0, 120),
        confidence: 'alta',
    };
}
