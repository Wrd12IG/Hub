/**
 * lib/client-scheda/service.ts
 *
 * L'orchestrazione della scheda cliente: controlli d'accesso, salvataggio delle righe, approvazioni, notifiche in app ed email.
 * Tutto ciò che tocca l'esterno entra da `deps` (nei test: finti). Le route sono solo un involucro.
 * Un invio email o notifica fallito NON annulla né blocca il salvataggio: si segnala nella risposta.
 */
import { canAccessScheda } from './access';
import { buildDecisionEmail, buildRequestEmail } from './emails';
import { buildLogEntry, decideApproval, validateNewLog, type Validated } from './log';
import { decisionRecipient, requestRecipients } from './recipients';
import { buildSchedaClient, type SchedaClient } from './whitelist';
import type { AbsenceLike, Approval, LogEntry, StaffUser } from './types';

export interface ListOptions { limit: number; before?: string; pendingOnly?: boolean }

export interface SchedaDeps {
    loadClient(id: string): Promise<Record<string, unknown> | null>;
    loadUsers(): Promise<StaffUser[]>;
    loadNotes(id: string): Promise<unknown>;
    canSeeNotes(role: string | undefined): Promise<boolean>;
    loadAbsences(): Promise<AbsenceLike[]>;
    listLogs(clientId: string, opts: ListOptions): Promise<LogEntry[]>;
    addLog(clientId: string, entry: Omit<LogEntry, 'id'>): Promise<string>;
    /** Legge la riga, applica `compute` e salva l'approvazione nello stesso passo (transazione): due decisioni insieme non passano entrambe. */
    decideLog(clientId: string, logId: string, compute: (entry: LogEntry) => Validated<Approval>): Promise<
        { kind: 'not_found' } | { kind: 'rejected'; error: string } | { kind: 'done'; entry: LogEntry; approval: Approval }
    >;
    notify(userIds: string[], n: { title: string; text: string; type: 'client_log_approval_requested' | 'client_log_approval_decided'; link: string; resourceId: string }): Promise<void>;
    sendEmail(to: { email: string; name: string }, m: { subject: string; html: string }): Promise<{ success: boolean }>;
    now(): Date;
    baseUrl: string;
}

export interface Result<T> { status: number; body: T | { error: string } }
const fail = (status: number, error: string): Result<never> => ({ status, body: { error } });

export const PAGE_SIZE = 50;

async function authorize(deps: SchedaDeps, uid: string, clientId: string) {
    const [raw, users] = await Promise.all([deps.loadClient(clientId), deps.loadUsers()]);
    if (!raw) return { ok: false, error: fail(404, 'Cliente non trovato.') } as const;
    const actor = users.find((u) => u.id === uid);
    const assignees = { managedBy: raw.managedBy as string[] | undefined, socialManagerId: raw.socialManagerId as string | undefined, backupManagerId: raw.backupManagerId as string | undefined };
    // Stessa risposta per «non esiste» e «non è tuo»: non si rivela quali clienti ci sono.
    if (!actor || !canAccessScheda(actor, assignees)) return { ok: false, error: fail(404, 'Cliente non trovato.') } as const;
    return { ok: true, raw, users, actor, assignees } as const;
}

export async function getScheda(deps: SchedaDeps, uid: string, clientId: string, opts: Partial<ListOptions> = {}): Promise<Result<{ client: SchedaClient; entries: LogEntry[]; nextBefore: string | null; canDecide: boolean }>> {
    const a = await authorize(deps, uid, clientId);
    if (!a.ok) return a.error;
    const canSeeNotes = await deps.canSeeNotes(a.actor.role);
    const names = Object.fromEntries(a.users.map((u) => [u.id, u.name]));
    const client = buildSchedaClient(clientId, a.raw, { userNames: names, notes: canSeeNotes ? await deps.loadNotes(clientId) : null, canSeeNotes });
    const limit = Math.min(Math.max(opts.limit ?? PAGE_SIZE, 1), 100);
    const rows = await deps.listLogs(clientId, { limit: limit + 1, before: opts.before, pendingOnly: opts.pendingOnly === true && a.actor.role === 'Amministratore' });
    const entries = rows.slice(0, limit);
    return { status: 200, body: { client, entries, nextBefore: rows.length > limit ? entries[entries.length - 1].createdAt : null, canDecide: a.actor.role === 'Amministratore' } };
}

export interface AddResult { entry: LogEntry; emails: { sent: number; failed: number } }

export async function addEntry(deps: SchedaDeps, uid: string, clientId: string, body: unknown): Promise<Result<AddResult>> {
    const a = await authorize(deps, uid, clientId);
    if (!a.ok) return a.error;
    const v = validateNewLog(body);
    if (!v.ok) return fail(400, v.error);
    const now = deps.now();
    const data = buildLogEntry(v.value, { id: a.actor.id, name: a.actor.name }, now);
    const entry: LogEntry = { id: await deps.addLog(clientId, data), ...data };

    const emails = { sent: 0, failed: 0 };
    if (entry.approval) {
        const link = `${deps.baseUrl}/clients/${clientId}/scheda`;
        const clientName = String(a.raw.name ?? clientId);
        try {
            const to = requestRecipients(a.users, a.assignees, await deps.loadAbsences(), a.actor.id, now);
            await deps.notify(to.map((u) => u.id), { title: '⚠️ Richiesta da approvare', text: `${entry.authorName} chiede un'approvazione su ${clientName}`, type: 'client_log_approval_requested', link, resourceId: entry.id });
            const mail = buildRequestEmail({ clientName, entry, link });
            // Un invio per persona, mai un'unica mail con tutti in copia.
            for (const u of to) {
                const r = await deps.sendEmail({ email: u.email as string, name: u.name }, mail).catch(() => ({ success: false }));
                if (r.success) emails.sent++; else emails.failed++;
            }
        } catch (e) {
            console.error('[scheda] notifiche richiesta', e);
            emails.failed++;
        }
    }
    return { status: 201, body: { entry, emails } };
}

export async function decideEntry(deps: SchedaDeps, uid: string, clientId: string, logId: string, body: unknown): Promise<Result<AddResult>> {
    const a = await authorize(deps, uid, clientId);
    if (!a.ok) return a.error;
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    const now = deps.now();
    const res = await deps.decideLog(clientId, logId, (entry) => decideApproval(entry, b.decision, b.comment, a.actor, now));
    if (res.kind === 'not_found') return fail(404, 'Riga non trovata.');
    if (res.kind === 'rejected') return fail(res.error === 'Solo un amministratore può decidere.' ? 403 : 409, res.error);

    const entry: LogEntry = { ...res.entry, approval: res.approval };
    const emails = { sent: 0, failed: 0 };
    const to = decisionRecipient(a.users, entry.authorId, a.actor.id);
    if (to) {
        const link = `${deps.baseUrl}/clients/${clientId}/scheda`;
        const clientName = String(a.raw.name ?? clientId);
        const decision = res.approval.status as 'approvata' | 'rifiutata';
        try {
            await deps.notify([to.id], { title: decision === 'approvata' ? '✅ Richiesta approvata' : '❌ Richiesta rifiutata', text: `La tua richiesta su ${clientName} è stata ${decision}`, type: 'client_log_approval_decided', link, resourceId: entry.id });
            const r = await deps.sendEmail({ email: to.email as string, name: to.name }, buildDecisionEmail({ clientName, entry, decision, deciderName: a.actor.name, comment: res.approval.comment, link })).catch(() => ({ success: false }));
            if (r.success) emails.sent++; else emails.failed++;
        } catch (e) {
            console.error('[scheda] notifiche esito', e);
            emails.failed++;
        }
    }
    return { status: 200, body: { entry, emails } };
}
