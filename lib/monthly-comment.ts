// Commento mensile dello staff sui risultati del cliente: clients/{id}/comments/{yyyy-MM}. Parti pure, senza Firestore.

export const MAX_COMMENT_LENGTH = 4000;

export const isValidMonth = (m: unknown): m is string => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

export function currentMonth(now: Date = new Date()): string {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Testo accettato dal salvataggio: stringa, ripulita ai bordi, entro il limite. null se non valido. */
export function cleanCommentText(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    const text = raw.replace(/\r\n/g, '\n').trim();
    return text.length <= MAX_COMMENT_LENGTH ? text : null;
}

/** Ultimi `n` mesi (il corrente per primo), per il selettore dell'editor. */
export function recentMonths(n = 12, now: Date = new Date()): string[] {
    return Array.from({ length: n }, (_, i) => currentMonth(new Date(now.getFullYear(), now.getMonth() - i, 1)));
}

export function monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
}
