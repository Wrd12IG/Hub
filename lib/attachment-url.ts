/**
 * attachment-url.ts
 *
 * Restituisce l'URL diretto per un allegato.
 *
 * Firebase Storage getDownloadURL() restituisce URL nella forma:
 *   https://firebasestorage.googleapis.com/v0/b/PROJECT/o/PATH?alt=media&token=DOWNLOAD_TOKEN
 *
 * Il download token incorporato (?token=...) rende l'URL accessibile
 * direttamente a chiunque abbia il link — nessun proxy necessario.
 * Questo è il comportamento standard e documentato di Firebase Storage.
 *
 * Per link esterni (Google Drive, Figma, ecc.) viene passato invariato.
 */
export function getAttachmentUrl(url: string, _token?: string | null): string {
    if (!url) return '#';

    // blob: URL sono temporanei e validi solo nel browser che li ha creati.
    if (url.startsWith('blob:')) return '#';

    // Tutti gli altri URL (Firebase Storage o link esterni) → diretto
    return url;
}

/** Alias per compatibilità con i componenti che non hanno authToken */
export function getAttachmentHrefDirect(url: string): string {
    return getAttachmentUrl(url, null);
}

/**
 * Versione sincrona senza token — usa localStorage come fallback.
 * Utile nei componenti che non possono usare hooks React (es. callback).
 */
export function getAttachmentUrlSync(url: string): string {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return getAttachmentUrl(url, token);
}
