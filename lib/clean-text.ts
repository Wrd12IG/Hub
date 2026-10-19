// Pulizia dei testi scritti da Claude con la ricerca web.

/**
 * Con la ricerca web il modello può avvolgere le frasi in marcatori di citazione (<cite index="2-3">…</cite>): la
 * citazione serve all'API, non a chi legge. Si tolgono i marcatori e si tiene il testo che contengono.
 */
export function stripCitations(text: string): string {
    return text
        .replace(/<\/?cite\b[^>]*>/gi, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\s+([.,;:!?])/g, '$1')
        .trim();
}

/**
 * Accorcia a `max` caratteri fermandosi a fine frase (o, in mancanza, a fine parola con i puntini), invece di tagliare
 * a metà parola come fa uno slice ("… Altre c").
 */
export function trimToSentence(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    if (end >= max * 0.5) return cut.slice(0, end + 1);
    const space = cut.lastIndexOf(' ');
    return `${cut.slice(0, space > 0 ? space : max).replace(/[,;:\s]+$/, '')}…`;
}
