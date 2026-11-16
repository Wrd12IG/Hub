/**
 * lib/monthly-mail-run.ts
 *
 * Le regole del giro automatico della mail mensile, come funzioni pure (si provano senza rete né Firestore).
 * Le chiama la route /api/cron/monthly-kpi-mail, che un servizio esterno (cron-job.org) interroga a intervalli.
 *
 * Il servizio chiama spesso, la route decide se c'è da fare qualcosa:
 *  - il mese da raccontare è sempre quello appena chiuso (dal calendario di Roma);
 *  - si parte dal giorno di invio scelto nelle impostazioni e, se quel giorno la mail non è partita, si recupera nei giorni
 *    dopo dello stesso mese (la mail parte una sola volta: lo garantisce un documento di registro, non il calendario);
 *  - i KPI si ricalcolano dal giorno di invio in poi, per tener dentro i dati reali inseriti all'ultimo; una fotografia
 *    fatta prima di quel giorno non è «fresca» e va rifatta.
 */

import { isMonthKey, previousMonthKey } from './manual-kpis';

/** Quante volte si riprova un cliente che fallisce prima di rassegnarsi a mandare la mail senza di lui. */
export const MAX_ATTEMPTS = 3;

const pad = (n: number) => String(n).padStart(2, '0');

/** Giorno di calendario a Roma come «AAAA-MM-GG». */
export function romeDateKey(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export type RunPlan =
    | { action: 'wait'; reason: string }
    | { action: 'run'; month: string; /** Una fotografia calcolata prima di questa data (AAAA-MM-GG, Roma) va rifatta. */ cutoff: string };

export interface PlanInput {
    now: Date;
    sendDay: number;
    /** Ignora il giorno di invio e ricalcola da oggi (uso manuale: «mandala adesso»). */
    force?: boolean;
    /** Un mese preciso (AAAA-MM) invece di quello appena chiuso. Solo con `force`. */
    month?: string | null;
}

export function planRun({ now, sendDay, force = false, month = null }: PlanInput): RunPlan {
    const today = romeDateKey(now);
    if (month !== null) {
        if (!force) return { action: 'wait', reason: 'Un mese preciso si chiede solo con force=1.' };
        if (!isMonthKey(month)) return { action: 'wait', reason: 'Mese non valido (AAAA-MM).' };
        return { action: 'run', month, cutoff: today };
    }
    if (force) return { action: 'run', month: previousMonthKey(now), cutoff: today };

    const day = Number(today.slice(8, 10));
    if (day < sendDay) return { action: 'wait', reason: `Parte dal giorno ${sendDay} del mese (oggi è il ${day}).` };
    return { action: 'run', month: previousMonthKey(now), cutoff: `${today.slice(0, 7)}-${pad(sendDay)}` };
}

/** La fotografia è abbastanza recente per la mail? (calcolata dalla data di cutoff in poi, a Roma). */
export function isFresh(computedAt: string | undefined, cutoff: string): boolean {
    if (!computedAt) return false;
    const t = new Date(computedAt);
    return Number.isFinite(t.getTime()) && romeDateKey(t) >= cutoff;
}

export interface ClientState { id: string; computedAt?: string; attempts: number }

/** Chi va ricalcolato adesso (non fresco e con tentativi ancora a disposizione) e chi ha esaurito i tentativi. */
export function splitWork(clients: ClientState[], cutoff: string): { todo: string[]; gaveUp: string[] } {
    const todo: string[] = [], gaveUp: string[] = [];
    for (const c of clients) {
        if (isFresh(c.computedAt, cutoff)) continue;
        (c.attempts >= MAX_ATTEMPTS ? gaveUp : todo).push(c.id);
    }
    return { todo, gaveUp };
}
