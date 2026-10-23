/**
 * lib/magnific/core.ts
 *
 * Le parti pure del collegamento a Magnific (ex Freepik): forma delle richieste, lettura delle risposte, controlli sugli
 * indirizzi e tetto giornaliero. Nessuna rete, nessun Firebase: si testano da sole (lib/__tests__/magnific.test.ts).
 * Documentazione: https://docs.magnific.com (chiave nell'intestazione `x-magnific-api-key`).
 */

export const MAGNIFIC_BASE = 'https://api.magnific.com';

export type TaskStatus = 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export interface MagnificTask { taskId: string; status: TaskStatus; generated: string[] }

const STATUSES: TaskStatus[] = ['CREATED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'];

/** La risposta di un'operazione asincrona: `{ data: { task_id, status, generated: [] } }`. Qualunque altra forma → null. */
export function normalizeTask(json: any): MagnificTask | null {
    const d = json?.data;
    if (!d || typeof d.task_id !== 'string' || !STATUSES.includes(d.status)) return null;
    const generated = Array.isArray(d.generated) ? d.generated.filter((u: unknown): u is string => typeof u === 'string' && /^https:\/\//i.test(u)) : [];
    return { taskId: d.task_id, status: d.status, generated };
}

export type Resolution = '1k' | '2k';

/** Corpo della richiesta di generazione (Mystic) in formato storia 9:16. */
export function buildMysticBody(prompt: string, resolution: Resolution = '2k') {
    return {
        prompt: prompt.trim(),
        aspect_ratio: 'social_story_9_16',
        resolution: resolution === '1k' ? '1k' : '2k',
        model: 'realism',
    };
}

export type PromptCheck = { ok: true; prompt: string } | { ok: false; error: string };
export const PROMPT_MIN = 5;
export const PROMPT_MAX = 600;

export function checkPrompt(raw: unknown): PromptCheck {
    const prompt = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
    if (prompt.length < PROMPT_MIN) return { ok: false, error: 'Descrivi meglio l\'immagine che vuoi' };
    if (prompt.length > PROMPT_MAX) return { ok: false, error: `La descrizione è troppo lunga (massimo ${PROMPT_MAX} caratteri)` };
    return { ok: true, prompt };
}

/** Solo https verso un nome di dominio vero: mai indirizzi numerici, localhost o reti interne (il server scarica da qui). */
export function isSafeRemoteUrl(raw: string): boolean {
    try {
        const u = new URL(raw);
        if (u.protocol !== 'https:' || u.username || u.password) return false;
        const h = u.hostname.toLowerCase();
        if (!h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return false;
        if (/^[\d.]+$/.test(h) || h.includes(':') || h.startsWith('[')) return false; // IPv4 / IPv6 letterali
        return true;
    } catch {
        return false;
    }
}

export const DEFAULT_DAILY_LIMIT = 25;

export function parseLimit(raw: string | undefined): number {
    const n = parseInt(raw || '', 10);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 1000) : DEFAULT_DAILY_LIMIT;
}

/** Il prossimo conteggio del giorno, o null se il tetto è raggiunto. */
export function nextCount(current: number, limit: number): number | null {
    return current >= limit ? null : current + 1;
}

/** Chiave del conteggio: un documento per utente e per giorno (UTC). */
export function usageKey(uid: string, now: Date): string {
    return `${uid}_${now.toISOString().slice(0, 10)}`;
}

/** Messaggio in italiano per un errore HTTP di Magnific. */
export function describeHttpError(status: number): string {
    if (status === 401) return 'La chiave Magnific non è valida: controlla MAGNIFIC_API_KEY su Vercel.';
    if (status === 402 || status === 403) return 'Crediti Magnific esauriti o piano senza accesso a questa funzione.';
    if (status === 429) return 'Troppe richieste a Magnific: riprova tra poco.';
    if (status === 400) return 'Magnific ha rifiutato la richiesta (descrizione o immagine non accettate).';
    return 'Magnific non risponde: riprova più tardi.';
}

export function extensionFor(contentType: string): string {
    if (/png/i.test(contentType)) return 'png';
    if (/webp/i.test(contentType)) return 'webp';
    return 'jpg';
}
