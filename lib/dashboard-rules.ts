import { differenceInCalendarDays, parseISO } from 'date-fns';

// Regole condivise dai widget della dashboard admin: lo stesso concetto
// (scadenza a 48h, progetto scaduto, rischio consegna) deve dare lo stesso
// numero ovunque venga mostrato.

const CLOSED_TASK = ['Approvato', 'Annullato'];

export const isTaskClosed = (t: { status?: string }) => CLOSED_TASK.includes(t.status || '');

/** Scadenza entro le prossime 48 ore, task ancora aperto. */
export function isDueWithin48h(task: { dueDate?: string; status?: string }, now: Date = new Date()): boolean {
    if (!task.dueDate || isTaskClosed(task)) return false;
    const due = parseISO(task.dueDate).getTime();
    return due >= now.getTime() && due <= now.getTime() + 48 * 3600 * 1000;
}

/**
 * Un progetto è di fatto concluso se è marcato Completato oppure se ha almeno un
 * task e tutti sono chiusi con almeno uno Approvato. Non scrive nulla: serve solo
 * a non segnarlo scaduto/critico quando il lavoro è finito.
 */
export function isProjectDone(project: { status?: string }, projectTasks: Array<{ status?: string }> = []): boolean {
    if (project.status === 'Completato') return true;
    if (project.status === 'Annullato') return false;
    return projectTasks.length > 0
        && projectTasks.every(isTaskClosed)
        && projectTasks.some(t => t.status === 'Approvato');
}

export function isProjectOverdue(
    project: { status?: string; endDate?: string },
    projectTasks: Array<{ status?: string }> = [],
    now: Date = new Date(),
): boolean {
    if (!project.endDate || project.status === 'Annullato') return false;
    if (isProjectDone(project, projectTasks)) return false;
    return parseISO(project.endDate).getTime() < now.getTime();
}

/** Giorni di ritardo già accumulati (0 se non scaduto). */
export function overdueDays(dueDate: Date, now: Date = new Date()): number {
    return Math.max(0, differenceInCalendarDays(now, dueDate));
}

/** Rischio consegna: un task già scaduto è sempre ad alto rischio, qualunque sia lo storico della tipologia. */
export function deliveryRisk(predictedDelay: number, alreadyOverdueDays: number): 'high' | 'medium' | 'low' {
    if (alreadyOverdueDays > 0) return 'high';
    return predictedDelay > 3 ? 'high' : predictedDelay > 1 ? 'medium' : 'low';
}
