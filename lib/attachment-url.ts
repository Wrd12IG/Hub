/**
 * attachment-url.ts
 *
 * Utility condivisa per generare URL sicuri degli allegati Firebase Storage.
 * Tutti i file su Firebase Storage vengono proxiati attraverso /api/tasks/attachment
 * che verifica l'autenticazione e genera un Signed URL temporaneo (15 min).
 *
 * Questo garantisce che QUALSIASI utente autenticato possa accedere agli allegati,
 * indipendentemente da chi li ha caricati.
 */

/**
 * Converte un URL Firebase Storage in un URL proxy autenticato.
 * I link esterni (non Firebase) vengono restituiti invariati.
 *
 * @param url - URL originale dell'allegato (può essere Firebase o link esterno)
 * @param token - Firebase ID token dell'utente corrente (da useAuthToken o localStorage)
 * @returns URL sicuro da usare in <a href> o <img src>
 */
export function getAttachmentUrl(url: string, token: string | null): string {
    if (!url) return '#';

    // blob: URL sono temporanei e validi solo nel browser che li ha creati.
    // Se sono stati salvati per errore su Firestore, non possono essere aperti
    // da altri utenti — restituiamo '#' per evitare redirect a pagine inesistenti.
    if (url.startsWith('blob:')) return '#';

    // Link esterno (es. Google Drive, Figma, ecc.) → passa diretto
    if (
        !url.includes('firebasestorage.googleapis.com') &&
        !url.startsWith('gs://')
    ) {
        return url;
    }

    // File Firebase Storage → proxy con auth check (15 min)
    const params = new URLSearchParams({ url });
    if (token) params.set('token', token);
    return `/api/tasks/attachment?${params.toString()}`;
}

/**
 * Versione sincrona senza token — usa localStorage come fallback.
 * Utile nei componenti che non possono usare hooks React (es. callback).
 */
export function getAttachmentUrlSync(url: string): string {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    return getAttachmentUrl(url, token);
}
