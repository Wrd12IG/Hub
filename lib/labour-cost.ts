// Costo del lavoro interno per cliente, mese per mese: ore registrate per il costo orario di chi le ha fatte.
// Usa lo stesso modello della dashboard admin (lib/cost-model.ts), quindi la stessa ora vale la stessa cifra ovunque.
// Due letture: costo diretto (ore × costo orario del profilo) e costo pieno (più il sovrapprezzo dei costi aziendali).
// Funzione pura: nessun accesso a Firestore o a React.

import { activityClientIds, activityCost, taskCost, type CostUser } from './cost-model';

export interface LabourTask { clientId?: string; timeSpent?: number; assignedUserId?: string; dueDate?: string; updatedAt?: string }
export interface LabourActivity { clientIds?: string[]; clientId?: string; startTime?: string; start?: string; endTime?: string; end?: string; userId?: string }

/** Le ore che non hanno un cliente (lavoro interno, riunioni…): una riga a parte, non si perdono nel totale. */
export const NO_CLIENT_ID = '__senza_cliente';
export const NO_CLIENT_NAME = 'Senza cliente (lavoro interno)';

/** Come si ripartisce il lavoro interno (ore senza cliente) sui clienti: nessuna ripartizione, in proporzione alle ore di ciascuno nel mese, o in parti uguali fra i clienti che in quel mese hanno lavoro. */
export type AllocateMode = 'none' | 'proportional' | 'equal';

export interface MonthCost { hours: number; cost: number; /** Costo diretto + sovrapprezzo orario dei costi aziendali. */ fullCost: number }
export interface ClientLabour {
    clientId: string;
    name: string;
    byMonth: Record<string, MonthCost>;
    /** Media dei mesi completi considerati (anche quelli a zero: un cliente fermo un mese costa meno in media). */
    monthlyCost: number;
    monthlyFullCost: number;
    monthlyHours: number;
    /** Il mese in corso, fin qui. */
    currentMonth: MonthCost;
}

export interface LabourReport {
    /** I mesi completi su cui si calcola la stima, dal più vecchio. */
    months: string[];
    current: string;
    /** Sovrapprezzo orario dei costi aziendali usato per il costo pieno (0 = costi aziendali non impostati). */
    hourlyOverhead: number;
    allocate: AllocateMode;
    clients: ClientLabour[];
    total: { monthlyCost: number; monthlyFullCost: number; monthlyHours: number; currentMonth: MonthCost };
}

const monthOf = (iso?: string): string | null => (typeof iso === 'string' && /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : null);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** `n` mesi completi che precedono quello di `now` (il più vecchio per primo), e il mese di `now`. */
export function monthWindow(n: number, now = new Date()): { months: string[]; current: string } {
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const months = Array.from({ length: n }, (_, i) => fmt(new Date(now.getFullYear(), now.getMonth() - (n - i), 1)));
    return { months, current: fmt(now) };
}

/**
 * Il sovrapprezzo orario dei costi aziendali, come lo calcola il pannello «Costi Aziendali»: costi mensili totali
 * (dirigenza + struttura + varie) ÷ collaboratori e PM attivi ÷ ore di lavoro al mese (160 di base).
 */
export function hourlyOverheadOf(
    costs: { dirigenza?: number; struttura?: number; varie?: number } | null | undefined,
    users: { role?: string; status?: string }[],
    monthlyWorkHours = 160,
): number {
    if (!costs) return 0;
    const total = (Number(costs.dirigenza) || 0) + (Number(costs.struttura) || 0) + (Number(costs.varie) || 0);
    const staff = users.filter((u) => (u.role === 'Collaboratore' || u.role === 'Project Manager') && u.status !== 'Inattivo').length;
    return staff > 0 && monthlyWorkHours > 0 ? total / staff / monthlyWorkHours : 0;
}

export function computeLabourCost(input: {
    tasks: LabourTask[];
    activities: LabourActivity[];
    usersById: Record<string, CostUser>;
    clientNames: Record<string, string>;
    months?: number;
    now?: Date;
    hourlyOverhead?: number;
    allocate?: AllocateMode;
}): LabourReport {
    const { months, current } = monthWindow(input.months ?? 3, input.now);
    const overhead = Math.max(0, input.hourlyOverhead ?? 0);
    const wanted = new Set([...months, current]);
    const acc = new Map<string, Record<string, MonthCost>>();

    const add = (clientId: string, month: string, hours: number, cost: number) => {
        if (!wanted.has(month) || hours <= 0) return;
        const m = acc.get(clientId) ?? {};
        const cur = m[month] ?? { hours: 0, cost: 0, fullCost: 0 };
        cur.hours += hours; cur.cost += cost; cur.fullCost += cost + hours * overhead;
        m[month] = cur;
        acc.set(clientId, m);
    };

    // Stessa data del report: scadenza del task, altrimenti ultimo aggiornamento
    for (const t of input.tasks) {
        const month = monthOf(t.dueDate) ?? monthOf(t.updatedAt);
        if (!month) continue;
        const { hours, cost } = taskCost(t, input.usersById);
        add(t.clientId || NO_CLIENT_ID, month, hours, cost);
    }
    // Un'attività con più clienti si divide in parti uguali; senza clienti va nella riga «senza cliente»
    for (const a of input.activities) {
        const month = monthOf(a.startTime ?? a.start);
        if (!month) continue;
        const ids = activityClientIds(a);
        const clients = ids.length > 0 ? ids : [NO_CLIENT_ID];
        const { hours, cost } = activityCost(a, input.usersById);
        for (const c of clients) add(c, month, hours / clients.length, cost / clients.length);
    }

    // Ripartizione del lavoro interno, mese per mese: le ore senza cliente di un mese si distribuiscono sui clienti che
    // in quello stesso mese hanno lavoro. Un mese in cui nessun cliente ha ore resta nella riga «senza cliente».
    const mode = input.allocate ?? 'none';
    const internal = acc.get(NO_CLIENT_ID);
    if (mode !== 'none' && internal) {
        for (const month of Array.from(wanted)) {
            const pool = internal[month];
            if (!pool) continue;
            const receivers = Array.from(acc.entries()).filter(([id, byMonth]) => id !== NO_CLIENT_ID && (byMonth[month]?.hours ?? 0) > 0);
            if (receivers.length === 0) continue;
            const totalHours = receivers.reduce((t, [, byMonth]) => t + byMonth[month].hours, 0);
            for (const [, byMonth] of receivers) {
                const share = mode === 'equal' ? 1 / receivers.length : byMonth[month].hours / totalHours;
                byMonth[month].hours += pool.hours * share;
                byMonth[month].cost += pool.cost * share;
                byMonth[month].fullCost += pool.fullCost * share;
            }
            delete internal[month];
        }
        if (Object.keys(internal).length === 0) acc.delete(NO_CLIENT_ID);
    }

    const sum = (byMonth: Record<string, MonthCost>, f: keyof MonthCost, ms: string[]) => ms.reduce((s, m) => s + (byMonth[m]?.[f] ?? 0), 0);
    const clients: ClientLabour[] = Array.from(acc.entries()).map(([clientId, byMonth]) => {
        const cur = byMonth[current] ?? { hours: 0, cost: 0, fullCost: 0 };
        return {
            clientId,
            name: clientId === NO_CLIENT_ID ? NO_CLIENT_NAME : (input.clientNames[clientId] ?? 'Cliente sconosciuto'),
            byMonth: Object.fromEntries(Object.entries(byMonth).map(([m, v]) => [m, { hours: r2(v.hours), cost: r2(v.cost), fullCost: r2(v.fullCost) }])),
            monthlyCost: r2(sum(byMonth, 'cost', months) / months.length),
            monthlyFullCost: r2(sum(byMonth, 'fullCost', months) / months.length),
            monthlyHours: r2(sum(byMonth, 'hours', months) / months.length),
            currentMonth: { hours: r2(cur.hours), cost: r2(cur.cost), fullCost: r2(cur.fullCost) },
        };
    // I clienti per costo decrescente; la riga «senza cliente» sempre in fondo
    }).sort((a, b) => (a.clientId === NO_CLIENT_ID ? 1 : 0) - (b.clientId === NO_CLIENT_ID ? 1 : 0) || b.monthlyFullCost - a.monthlyFullCost || b.currentMonth.fullCost - a.currentMonth.fullCost);

    // I totali si sommano dai valori non arrotondati: sommare i valori già arrotondati per cliente sposta i centesimi
    const raw = (f: keyof MonthCost, ms: string[]) => Array.from(acc.values()).reduce((s, byMonth) => s + sum(byMonth, f, ms), 0);
    return {
        months, current, hourlyOverhead: r2(overhead), allocate: mode, clients,
        total: {
            monthlyCost: r2(raw('cost', months) / months.length),
            monthlyFullCost: r2(raw('fullCost', months) / months.length),
            monthlyHours: r2(raw('hours', months) / months.length),
            currentMonth: { hours: r2(raw('hours', [current])), cost: r2(raw('cost', [current])), fullCost: r2(raw('fullCost', [current])) },
        },
    };
}
