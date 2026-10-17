import { differenceInSeconds, parseISO } from 'date-fns';

// Unico modello di costo della dashboard admin: ogni widget (costi per cliente,
// per attività, andamento mensile, redditività, tabella per utente) deve passare
// da qui, altrimenti la stessa ora di lavoro vale cifre diverse in riquadri diversi.

export const OVERHEAD_MONTHLY_HOURS = 160;

const BILLABLE_ROLES = ['Collaboratore', 'Project Manager'];

export interface CostUser {
    id: string;
    role?: string;
    status?: string;
    hourlyRate?: number | string;
}

export interface CompanyCostsInput {
    dirigenza?: number;
    struttura?: number;
    varie?: number;
}

export function isBillable(user?: Pick<CostUser, 'role'> | null): boolean {
    return !!user && BILLABLE_ROLES.includes(user.role || '');
}

/** Accetta numeri e stringhe in formato italiano ("12,50"). */
export function parseRate(raw: number | string | undefined | null): number {
    if (typeof raw === 'string') return parseFloat(raw.replace(',', '.')) || 0;
    return Number(raw) || 0;
}

/** Overhead orario per dipendente: costi fissi / dipendenti attivi / 160h. */
export function computeHourlyOverhead(costs: CompanyCostsInput | null | undefined, users: CostUser[]): number {
    if (!costs) return 0;
    const billable = users.filter(u => isBillable(u) && u.status !== 'Inattivo');
    const total = (costs.dirigenza || 0) + (costs.struttura || 0) + (costs.varie || 0);
    if (billable.length === 0 || total <= 0) return 0;
    return total / billable.length / OVERHEAD_MONTHLY_HOURS;
}

export interface Rate {
    base: number;
    overhead: number;
    effective: number;
}

/** Tariffa di un utente. Utente assente (task non assegnato) = 0: ore contate, costo no. */
export function rateFor(user: CostUser | null | undefined, hourlyOverhead: number): Rate {
    if (!user) return { base: 0, overhead: 0, effective: 0 };
    const base = parseRate(user.hourlyRate);
    const overhead = isBillable(user) ? hourlyOverhead : 0;
    return { base, overhead, effective: base + overhead };
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

export function taskCost(task: any, usersById: Record<string, CostUser>, hourlyOverhead: number): CostLine {
    const hours = taskHours(task);
    const user = task.assignedUserId ? usersById[task.assignedUserId] : null;
    return { hours, cost: hours * rateFor(user, hourlyOverhead).effective };
}

export function activityCost(activity: any, usersById: Record<string, CostUser>, hourlyOverhead: number): CostLine {
    const hours = activityHours(activity);
    const user = activity.userId ? usersById[activity.userId] : null;
    return { hours, cost: hours * rateFor(user, hourlyOverhead).effective };
}
