/**
 * lib/client-scheda/log.ts
 *
 * Il registro delle interazioni: validazione di una nuova riga e transizioni dell'approvazione. Pure.
 * La data NON arriva mai dal form: la passa chi salva (ora del server). Le righe non si modificano né si cancellano.
 */
import { canDecideApproval } from './access';
import { LOG_TYPES, type Approval, type LogEntry, type LogType, type Role } from './types';

export const MAX_TEXT = 2000;
export const MAX_COMMENT = 500;

export interface NewLogInput { type: LogType; text: string; requestApproval: boolean }
export type Validated<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateNewLog(body: unknown): Validated<NewLogInput> {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    if (typeof b.type !== 'string' || !(LOG_TYPES as readonly string[]).includes(b.type)) return { ok: false, error: 'Tipo non valido.' };
    const text = typeof b.text === 'string' ? b.text.trim() : '';
    if (!text) return { ok: false, error: 'Scrivi che cosa è successo.' };
    if (text.length > MAX_TEXT) return { ok: false, error: `Testo troppo lungo (massimo ${MAX_TEXT} caratteri).` };
    // createdAt, authorId, approval… eventualmente presenti nel body vengono ignorati: si costruisce solo ciò che serve.
    return { ok: true, value: { type: b.type as LogType, text, requestApproval: b.requestApproval === true } };
}

export function buildLogEntry(
    input: NewLogInput, author: { id: string; name: string }, now: Date,
): Omit<LogEntry, 'id'> {
    const at = now.toISOString();
    return {
        createdAt: at,
        authorId: author.id,
        authorName: author.name,
        type: input.type,
        text: input.text,
        approval: input.requestApproval ? { status: 'in_attesa', requestedAt: at, decidedBy: null, decidedByName: null, decidedAt: null, comment: null } : null,
    };
}

export function decideApproval(
    entry: Pick<LogEntry, 'approval'>,
    decision: unknown,
    comment: unknown,
    user: { id: string; name: string; role?: Role; status?: string },
    now: Date,
): Validated<Approval> {
    if (!canDecideApproval(user)) return { ok: false, error: 'Solo un amministratore può decidere.' };
    if (!entry.approval) return { ok: false, error: 'Questa riga non richiede approvazione.' };
    if (entry.approval.status !== 'in_attesa') return { ok: false, error: 'La richiesta è già stata decisa.' };
    if (decision !== 'approvata' && decision !== 'rifiutata') return { ok: false, error: 'Decisione non valida.' };
    const c = typeof comment === 'string' ? comment.trim() : '';
    if (c.length > MAX_COMMENT) return { ok: false, error: `Commento troppo lungo (massimo ${MAX_COMMENT} caratteri).` };
    return {
        ok: true,
        value: { ...entry.approval, status: decision, decidedBy: user.id, decidedByName: user.name, decidedAt: now.toISOString(), comment: c || null },
    };
}
