// Nome leggibile per un allegato. Molti link sono stati salvati con il nome generico
// «Link allegato»: in Documenti e Media diventavano migliaia di righe identiche.
// Qui il nome si ricava dall'indirizzo (servizio + ultima parte del percorso). Pura.

const GENERIC = new Set(['', 'link allegato', 'link', 'allegato']);

const SERVICES: Array<[RegExp, string]> = [
    [/(^|\.)drive\.google\.com$/i, 'Google Drive'],
    [/(^|\.)docs\.google\.com$/i, 'Google Docs'],
    [/(^|\.)canva\.com$/i, 'Canva'],
    [/(^|\.)wetransfer\.com$|(^|\.)we\.tl$/i, 'WeTransfer'],
    [/(^|\.)dropbox\.com$/i, 'Dropbox'],
    [/(^|\.)figma\.com$/i, 'Figma'],
    [/(^|\.)instagram\.com$/i, 'Instagram'],
    [/(^|\.)pinterest\.[a-z.]+$/i, 'Pinterest'],
    [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/i, 'YouTube'],
    [/(^|\.)firebasestorage\.googleapis\.com$/i, ''],
];

// Id dei servizi (Drive, Canva…): lunghi, con maiuscole e cifre mescolate. Gli slug delle pagine sono minuscoli.
function looksLikeId(segment: string): boolean {
    return (/^[A-Za-z0-9_-]{16,}$/.test(segment) && /[A-Z]/.test(segment) && /\d/.test(segment))
        || /^[A-Za-z0-9]{20,}$/.test(segment);
}

function safeDecode(s: string): string {
    try { return decodeURIComponent(s); } catch { return s; }
}

/** true se il nome salvato non dice nulla e conviene ricavarlo dall'indirizzo. */
export function isGenericAttachmentName(name: string | undefined | null): boolean {
    return GENERIC.has((name ?? '').trim().toLowerCase());
}

/** Nome ricavato dall'URL: «Google Drive · cartella», «Canva», «sito.it · pagina», o il nome del file. */
export function nameFromUrl(url: string): string {
    let u: URL;
    try { u = new URL(url); } catch { return url.slice(0, 60) || 'Link'; }
    const host = u.hostname.replace(/^www\./, '');
    const service = SERVICES.find(([re]) => re.test(u.hostname));
    // Firebase Storage: il nome del file è nell'ultimo pezzo del percorso codificato (…/o/cartella%2Ffile.pdf)
    const segments = safeDecode(u.pathname).split('/').filter(Boolean);
    const last = segments[segments.length - 1] ?? '';
    const isFile = /\.[a-z0-9]{2,5}$/i.test(last);
    if (service && service[1] === '') return last || 'File';
    if (isFile) return last;
    const label = service ? service[1] : host;
    // Per i servizi l'ultimo pezzo è spesso un id illeggibile: lo mostriamo solo se sembra una parola
    const readable = last && !looksLikeId(last) && !['view', 'edit', 'd', 'p', 'file', 'folders'].includes(last) ? last : '';
    return readable ? `${label} · ${readable.replace(/[-_]+/g, ' ')}` : label;
}

/** Nome da mostrare: quello salvato se significativo, altrimenti quello ricavato dall'URL. */
export function displayAttachmentName(att: { filename?: string | null; url?: string | null }): string {
    if (!isGenericAttachmentName(att.filename)) return (att.filename as string).trim();
    return att.url ? nameFromUrl(att.url) : 'Link';
}
