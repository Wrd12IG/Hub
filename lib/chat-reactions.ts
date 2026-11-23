/**
 * lib/chat-reactions.ts
 *
 * Le reazioni ai messaggi della chat: le emoji rapide e la regola per aggiungere/togliere una reazione. Pura (nessun I/O).
 */

/** Reazioni rapide mostrate sotto il pulsante «faccina» di ogni messaggio. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export const MAX_EMOJI_LENGTH = 16;

export type Reactions = Record<string, string[]>;

/** Una emoji valida come nome di campo: non vuota e breve (Firestore rifiuta i nomi di campo vuoti). */
export function isValidReaction(emoji: unknown): emoji is string {
    return typeof emoji === 'string' && emoji.trim().length > 0 && emoji.trim().length <= MAX_EMOJI_LENGTH;
}

/** Se l'utente aveva già reagito con quella emoji la toglie, altrimenti la aggiunge. Non modifica l'oggetto in ingresso. */
export function toggleReaction(reactions: Reactions | null | undefined, emoji: string, userId: string): Reactions {
    const key = emoji.trim();
    const out: Reactions = { ...(reactions || {}) };
    const current = out[key] || [];
    const next = current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId];
    if (next.length === 0) delete out[key];
    else out[key] = next;
    return out;
}
