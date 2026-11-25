/**
 * lib/staff-todo.ts
 *
 * «Da chiudere oggi» per lo staff: brief da valutare o consegnare e contenuti del PED fermi per colpa nostra o del cliente.
 * Pura (nessun I/O): la pagina porta i dati, qui si decide cosa conta e in che ordine.
 */
import type { Brief, EditorialContent } from './data';
import { briefTodo, type BriefTodo } from './brief-status';

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

export interface StaffTodo { briefs: BriefTodo; ped: PedTodo; total: number }

export function staffTodo(input: { briefs: Brief[]; contents: EditorialContent[]; now: Date }): StaffTodo {
    const today = input.now.toISOString().slice(0, 10);
    const briefs = briefTodo(input.briefs, today);
    const ped = pedTodo(input.contents, input.now);
    const total = briefs.toEvaluate.length + briefs.inProgress.length + ped.changesRequested.length + ped.waitingClient.length;
    return { briefs, ped, total };
}
