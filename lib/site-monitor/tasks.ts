/**
 * lib/site-monitor/tasks.ts
 *
 * Dai problemi nuovi ai task. Regole:
 *  - solo gravità media e alta, i più importanti per primi, al massimo 10 a scansione;
 *  - un task per pagina e tipo (gruppo), mai due task per lo stesso gruppo: se ce n'è uno aperto, o chiuso da meno di 30 giorni, non se ne crea un altro;
 *  - senza utenti designati non si crea nulla e i problemi restano «nuovi» (si vedono nella pagina del monitor);
 *  - i task si assegnano a turno agli utenti designati.
 */
import { buildTaskDraft, groupFindings, selectForTasks, type TaskDraft } from './group';
import { fingerprint } from './fingerprint';
import type { FindingRecord } from './store';

export const REOPEN_DAYS = 30;
export const MAX_TASKS_PER_SCAN = 10;

export interface ExistingTask { status: string; updatedAt?: string }

export interface TaskPort {
    /** I task già creati per questo gruppo (chiave `siteMonitorKey`). */
    findByKey(clientId: string, key: string): Promise<ExistingTask[]>;
    create(task: TaskDraft & { clientId: string; assignedUserId: string; siteMonitorKey: string }): Promise<string>;
}

export interface CreateTasksResult { created: number; skipped: number; reason?: 'nessun_utente_designato'; updated: FindingRecord[] }

const CLOSED = new Set(['Approvato', 'Annullato']);

function blocksNewTask(existing: ExistingTask[], now: Date): boolean {
    return existing.some((t) => {
        if (!CLOSED.has(t.status)) return true;
        const closedAt = t.updatedAt ? Date.parse(t.updatedAt) : NaN;
        return !Number.isFinite(closedAt) || now.getTime() - closedAt < REOPEN_DAYS * 86_400_000;
    });
}

export async function createTasksForFindings(
    clientId: string, clientName: string, records: FindingRecord[], assigneeIds: string[], port: TaskPort, now: Date,
    opts: { only?: Set<string> } = {},
): Promise<CreateTasksResult> {
    if (assigneeIds.length === 0) return { created: 0, skipped: 0, reason: 'nessun_utente_designato', updated: [] };
    const eligible = records.filter((r) => r.status === 'nuovo' && (!opts.only || opts.only.has(r.fingerprint)));
    const byFp = new Map(eligible.map((r) => [r.fingerprint, r]));
    const groups = selectForTasks(groupFindings(eligible), { max: MAX_TASKS_PER_SCAN, minSeverity: 'media' });

    let created = 0, skipped = 0;
    const updated: FindingRecord[] = [];
    for (const g of groups) {
        if (blocksNewTask(await port.findByKey(clientId, g.key), now)) { skipped++; continue; }
        const draft = buildTaskDraft(g, { clientName, now });
        const taskId = await port.create({ ...draft, clientId, assignedUserId: assigneeIds[created % assigneeIds.length], siteMonitorKey: g.key });
        created++;
        for (const f of g.findings) {
            const rec = byFp.get(fingerprint(f));
            if (rec) updated.push({ ...rec, status: 'task_creato', taskId });
        }
    }
    return { created, skipped, updated };
}

export function firestoreTaskPort(): TaskPort {
    return {
        async findByKey(clientId, key) {
            const { adminDb } = await import('@/lib/firebase-admin');
            const snap = await adminDb.collection('tasks').where('siteMonitorKey', '==', key).where('clientId', '==', clientId).get();
            return snap.docs.map((d) => {
                const u = d.get('updatedAt');
                return { status: String(d.get('status')), updatedAt: typeof u === 'string' ? u : u?.toDate?.().toISOString() };
            });
        },
        async create(t) {
            const { adminDb } = await import('@/lib/firebase-admin');
            const { Timestamp } = await import('firebase-admin/firestore');
            const ref = await adminDb.collection('tasks').add({
                title: t.title, description: t.description, priority: t.priority, clientId: t.clientId,
                estimatedDuration: t.estimatedDuration, assignedUserId: t.assignedUserId,
                status: 'Da Fare', timeSpent: 0, actualDuration: 0, attachments: [], comments: [],
                createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
                createdBy: 'site-monitor', siteMonitorKey: t.siteMonitorKey,
            });
            return ref.id;
        },
    };
}
