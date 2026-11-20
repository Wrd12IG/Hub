import { htmlToText } from '@/lib/site-intelligence';

/** Oltre questa lunghezza il testo di una pagina non si analizza: protegge da pagine enormi o costruite apposta. */
export const MAX_ANALYZED_CHARS = 400_000;
const MAX_HTML_CHARS = 2_000_000;

/** Una riga di una pagina ripulita per mostrarla come prova: senza caratteri di controllo, spazi compressi, al massimo `max` caratteri. */
export function cleanSnippet(text: string, max = 300): string {
    const t = text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/**
 * Il testo visibile di una pagina, compreso il piè di pagina (dove sta il copyright).
 * Prima si tolgono i commenti HTML: un'offerta vecchia lasciata «commentata» non è visibile ai visitatori e non va segnalata.
 */
export function pageText(html: string): string {
    const cleaned = html
        .slice(0, MAX_HTML_CHARS)
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/&(?:copy|#169|#xa9);/gi, '©')
        .replace(/&(?:ndash|mdash|#8211|#8212);/gi, '-')
        .replace(/&(?:ensp|emsp|thinsp|#8201);/gi, ' ');
    return htmlToText(cleaned, MAX_ANALYZED_CHARS);
}

export function wordCount(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
}

const MONTH_NAMES = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
/** «luglio 2019» */
export function monthYear(d: Date): string {
    return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
