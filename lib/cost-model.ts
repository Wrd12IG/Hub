import { differenceInSeconds, parseISO } from 'date-fns';

// Unico modello di costo della dashboard admin: ogni widget (costi per cliente,
// per attività, andamento mensile, redditività, tabella per utente) deve passare
// da qui, altrimenti la stessa ora di lavoro vale cifre diverse in riquadri diversi.

/** Costo orario di partenza: ogni utente ha 30 €/h salvati nel profilo; se manca vale questo. */
export const DEFAULT_HOURLY_RATE = 30;

/** Accetta numeri e stringhe in formato italiano ("30,00"). */
export function parseRate(raw: number | string | undefined | null): number {
    if (typeof raw === 'string') return parseFloat(raw.replace(',', '.')) || 0;
    return Number(raw) || 0;
}

export interface CostUser {
    hourlyRate?: number | string;
}

/** Costo orario dell'utente (dal suo profilo). Senza utente o senza tariffa: 30 €/h. */
export function rateOf(user?: CostUser | null): number {
    const rate = parseRate(user?.hourlyRate);
    return rate > 0 ? rate : DEFAULT_HOURLY_RATE;
}

export function taskHours(task: { timeSpent?: number }): number {
    return Math.max(task.timeSpent || 0, 0) / 3600;
}

/** Durata in ore; supporta startTime/endTime e i campi legacy start/end. 0 se invalida. */
export function activityHours(activity: any): number {
    const start = activity.startTime || activity.start;
    const end = activity.endTime || activity.end;
    if (!start || !end) return 0;
    const seconds = differenceInSeconds(parseISO(end), parseISO(start));
    return seconds > 0 ? seconds / 3600 : 0;
}

/** Supporta clientIds (array) e clientId (legacy). */
export function activityClientIds(activity: any): string[] {
    if (activity.clientIds && activity.clientIds.length > 0) return activity.clientIds;
    return activity.clientId ? [activity.clientId] : [];
}

export interface CostLine {
    hours: number;
    cost: number;
}

export function taskCost(task: { timeSpent?: number; assignedUserId?: string }, usersById: Record<string, CostUser>): CostLine {
    const hours = taskHours(task);
    const user = task.assignedUserId ? usersById[task.assignedUserId] : null;
    return { hours, cost: hours * rateOf(user) };
}

export function activityCost(activity: any, usersById: Record<string, CostUser>): CostLine {
    const hours = activityHours(activity);
    const user = activity.userId ? usersById[activity.userId] : null;
    return { hours, cost: hours * rateOf(user) };
}
