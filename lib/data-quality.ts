import { differenceInCalendarDays, parseISO } from 'date-fns';
import { activityClientIds, activityHours, taskHours, DEFAULT_HOURLY_RATE } from '@/lib/cost-model';

// Elenca i dati che falsano i totali della dashboard (ore e costi che non finiscono
// dove dovrebbero). Funzione pura: nessun accesso a Firestore.

/** Un'attività più lunga di così, o su più giorni, è quasi sempre un evento "tutto il giorno". */
export const MAX_PLAUSIBLE_ACTIVITY_HOURS = 10;
const MIN_YEAR = 2020;

export interface TaskIssue {
    id: string;
    title: string;
    clientName: string;
    userName: string;
    status: string;
    hours: number;
}

export interface ActivityIssue {
    id: string;
    title: string;
    clientName: string;
    userName: string;
    date: string;
    hours: number;
    reason: string;
}

export interface DataQualityReport {
    tasksNoAssignee: TaskIssue[];
    tasksNoClient: TaskIssue[];
    activitiesNoClient: ActivityIssue[];
    activitiesNoUser: ActivityIssue[];
    activitiesSuspicious: ActivityIssue[];
    /** Ore registrate ma non attribuibili a nessun cliente (task + attività senza cliente). */
    unassignedClientHours: number;
    unassignedClientCost: number;
    suspiciousHours: number;
}

const byHoursDesc = <T extends { hours: number }>(a: T, b: T) => b.hours - a.hours;

export function findDataIssues(input: {
    tasks: any[];
    activities: any[];
    usersById: Record<string, any>;
    clientsById: Record<string, any>;
    now?: Date;
}): DataQualityReport {
    const { tasks, activities, usersById, clientsById } = input;
    const maxYear = (input.now || new Date()).getFullYear() + 1;

    const userName = (id?: string) => (id && usersById[id]?.name) || 'Nessuno';
    const clientNames = (ids: string[]) =>
        ids.map(id => clientsById[id]?.name).filter(Boolean).join(', ') || 'Nessuno';

    const tasksWithHours = tasks.filter(t => taskHours(t) > 0);
    const toTask = (t: any): TaskIssue => ({
        id: t.id,
        title: t.title || '(senza titolo)',
        clientName: clientNames(t.clientId ? [t.clientId] : []),
        userName: userName(t.assignedUserId),
        status: t.status || '',
        hours: parseFloat(taskHours(t).toFixed(1)),
    });

    const tasksNoAssignee = tasksWithHours
        .filter(t => !t.assignedUserId || !usersById[t.assignedUserId])
        .map(toTask).sort(byHoursDesc);
    const tasksNoClient = tasksWithHours
        .filter(t => !t.clientId || !clientsById[t.clientId])
        .map(toTask).sort(byHoursDesc);

    const activitiesNoClient: ActivityIssue[] = [];
    const activitiesNoUser: ActivityIssue[] = [];
    const activitiesSuspicious: ActivityIssue[] = [];

    activities.forEach(a => {
        const start = a.startTime || a.start;
        const end = a.endTime || a.end;
        const hours = activityHours(a);
        const ids = activityClientIds(a).filter(id => clientsById[id]);
        const base = {
            id: a.id,
            title: a.title || '(senza titolo)',
            clientName: clientNames(ids),
            userName: userName(a.userId),
            date: start ? String(start).slice(0, 10) : '—',
            hours: parseFloat(hours.toFixed(1)),
        };

        // Il costo non dipende dall'utente (tariffa unica), ma l'attività resta non attribuibile a una persona.
        if (hours > 0 && ids.length === 0) activitiesNoClient.push({ ...base, reason: 'Senza cliente' });
        if (hours > 0 && (!a.userId || !usersById[a.userId])) activitiesNoUser.push({ ...base, reason: 'Senza utente' });

        const reasons: string[] = [];
        if (!start || !end) {
            reasons.push('Orario di inizio o fine mancante');
        } else {
            const s = parseISO(start);
            const e = parseISO(end);
            if (e.getTime() <= s.getTime()) reasons.push('Fine prima o uguale all\'inizio: ore perse');
            else {
                if (hours > MAX_PLAUSIBLE_ACTIVITY_HOURS) reasons.push(`Durata ${hours.toFixed(1)}h (oltre ${MAX_PLAUSIBLE_ACTIVITY_HOURS}h)`);
                if (differenceInCalendarDays(e, s) >= 1) reasons.push(`Su ${differenceInCalendarDays(e, s) + 1} giorni`);
            }
            if (s.getFullYear() < MIN_YEAR || s.getFullYear() > maxYear) reasons.push(`Anno anomalo (${s.getFullYear()})`);
        }
        if (reasons.length > 0) activitiesSuspicious.push({ ...base, reason: reasons.join(' · ') });
    });

    activitiesNoClient.sort(byHoursDesc);
    activitiesNoUser.sort(byHoursDesc);
    activitiesSuspicious.sort(byHoursDesc);

    const unassignedClientHours =
        tasksNoClient.reduce((s, t) => s + t.hours, 0) + activitiesNoClient.reduce((s, a) => s + a.hours, 0);

    return {
        tasksNoAssignee,
        tasksNoClient,
        activitiesNoClient,
        activitiesNoUser,
        activitiesSuspicious,
        unassignedClientHours: parseFloat(unassignedClientHours.toFixed(1)),
        unassignedClientCost: parseFloat((unassignedClientHours * DEFAULT_HOURLY_RATE).toFixed(2)),
        suspiciousHours: parseFloat(activitiesSuspicious.reduce((s, a) => s + a.hours, 0).toFixed(1)),
    };
}
