/**
 * lib/staff-todo.ts
 *
 * «Da chiudere oggi» per lo staff: brief da valutare o consegnare e contenuti del PED fermi per colpa nostra o del cliente.
 * Pura (nessun I/O): la pagina porta i dati, qui si decide cosa conta e in che ordine.
 */
import type { Brief, EditorialContent, Task } from './data';
import { briefTodo, type BriefTodo } from './brief-status';
import { CLIENT_WAIT_REMINDER_DAYS, isClosedTask, isWaitingOnClient } from './task-model';

export interface PedTodo {
    /** Il cliente ha chiesto modifiche: tocca a noi. Non ancora pubblicati. */
    changesRequested: EditorialContent[];
    /** Mandati al cliente e senza risposta: da sollecitare dopo qualche giorno. */
    waitingClient: EditorialContent[];
}

/** Dopo quanti giorni senza risposta il cliente va sollecitato. */
export const REMINDER_AFTER_DAYS = 3;

export function pedTodo(contents: EditorialContent[], now: Date): PedTodo {
    const reminderBefore = new Date(now.getTime() - REMINDER_AFTER_DAYS * 86_400_000).toISOString();
    const open = contents.filter((c) => c.status !== 'Pubblicato');
    const byRequested = (a: EditorialContent, b: EditorialContent) => String(a.approval?.requestedAt).localeCompare(String(b.approval?.requestedAt));
    return {
        changesRequested: open.filter((c) => c.approval?.status === 'changes').sort(byRequested),
        waitingClient: open
            .filter((c) => c.approval?.status === 'requested' && !!c.approval.requestedAt && c.approval.requestedAt < reminderBefore)
            .sort(byRequested),
    };
}

export interface TaskTodo {
    /** In «In attesa cliente» da più di CLIENT_WAIT_REMINDER_DAYS giorni: da sollecitare. */
    waitingClient: Task[];
    /** Priorità Critica, con la scadenza già passata e non chiusi. Se la palla è del cliente non è un ritardo nostro. */
    criticalOverdue: Task[];
}

/** Da quando il task è nello stato attuale. Per i task nati prima del campo si ripiega sull'ultimo aggiornamento, poi sulla creazione. */
export function taskSince(t: Pick<Task, 'statusChangedAt' | 'updatedAt' | 'createdAt'>): string | undefined {
    for (const v of [t.statusChangedAt, t.updatedAt, t.createdAt]) if (typeof v === 'string' && v) return v;
    return undefined;
}

export function taskTodo(tasks: Task[], now: Date): TaskTodo {
    const waitBefore = new Date(now.getTime() - CLIENT_WAIT_REMINDER_DAYS * 86_400_000).toISOString();
    const today = now.toISOString().slice(0, 10);
    const bySince = (a: Task, b: Task) => String(taskSince(a)).localeCompare(String(taskSince(b)));
    return {
        waitingClient: tasks
            .filter((t) => isWaitingOnClient(t) && !!taskSince(t) && (taskSince(t) as string) < waitBefore)
            .sort(bySince),
        criticalOverdue: tasks
            .filter((t) => t.priority === 'Critica' && !isClosedTask(t) && !isWaitingOnClient(t) && !!t.dueDate && t.dueDate.slice(0, 10) < today)
            .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))),
    };
}

export interface StaffTodo { briefs: BriefTodo; ped: PedTodo; tasks: TaskTodo; total: number }

export function staffTodo(input: { briefs: Brief[]; contents: EditorialContent[]; tasks?: Task[]; now: Date }): StaffTodo {
    const today = input.now.toISOString().slice(0, 10);
    const briefs = briefTodo(input.briefs, today);
    const ped = pedTodo(input.contents, input.now);
    const tasks = taskTodo(input.tasks ?? [], input.now);
    const total = briefs.toEvaluate.length + briefs.inProgress.length + ped.changesRequested.length + ped.waitingClient.length
        + tasks.waitingClient.length + tasks.criticalOverdue.length;
    return { briefs, ped, tasks, total };
}
