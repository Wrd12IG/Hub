import { differenceInSeconds, parseISO } from 'date-fns';

// Unico modello di costo della dashboard admin: ogni widget (costi per cliente,
// per attività, andamento mensile, redditività, tabella per utente) deve passare
// da qui, altrimenti la stessa ora di lavoro vale cifre diverse in riquadri diversi.

/** Tariffa unica per ogni ora di lavoro, qualunque persona o servizio (decisione di Roberto). */
export const HOURLY_RATE = 30;

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

export function taskCost(task: { timeSpent?: number }): CostLine {
    const hours = taskHours(task);
    return { hours, cost: hours * HOURLY_RATE };
}

export function activityCost(activity: any): CostLine {
    const hours = activityHours(activity);
    return { hours, cost: hours * HOURLY_RATE };
}
