// Costo del lavoro interno per cliente, mese per mese: ore registrate per il costo orario di chi le ha fatte.
// Usa lo stesso modello della dashboard admin (lib/cost-model.ts), quindi la stessa ora vale la stessa cifra ovunque.
// Funzione pura: nessun accesso a Firestore o a React.

import { activityClientIds, activityCost, taskCost, type CostUser } from './cost-model';

export interface LabourTask { clientId?: string; timeSpent?: number; assignedUserId?: string; dueDate?: string; updatedAt?: string }
export interface LabourActivity { clientIds?: string[]; clientId?: string; startTime?: string; start?: string; endTime?: string; end?: string; userId?: string }

export interface MonthCost { hours: number; cost: number }
export interface ClientLabour {
    clientId: string;
    name: string;
    byMonth: Record<string, MonthCost>;
    /** Media dei mesi completi considerati (anche quelli a zero: un cliente fermo un mese costa meno in media). */
    monthlyCost: number;
    monthlyHours: number;
    /** Il mese in corso, fin qui. */
    currentMonth: MonthCost;
}

export interface LabourReport {
    /** I mesi completi su cui si calcola la stima, dal più vecchio. */
    months: string[];
    current: string;
    clients: ClientLabour[];
    total: { monthlyCost: number; monthlyHours: number; currentMonth: MonthCost };
}

const monthOf = (iso?: string): string | null => (typeof iso === 'string' && /^\d{4}-\d{2}/.test(iso) ? iso.slice(0, 7) : null);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** `n` mesi completi che precedono quello di `now` (il più vecchio per primo), e il mese di `now`. */
export function monthWindow(n: number, now = new Date()): { months: string[]; current: string } {
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const months = Array.from({ length: n }, (_, i) => fmt(new Date(now.getFullYear(), now.getMonth() - (n - i), 1)));
    return { months, current: fmt(now) };
}

export function computeLabourCost(input: {
    tasks: LabourTask[];
    activities: LabourActivity[];
    usersById: Record<string, CostUser>;
    clientNames: Record<string, string>;
    months?: number;
    now?: Date;
}): LabourReport {
    const { months, current } = monthWindow(input.months ?? 3, input.now);
    const wanted = new Set([...months, current]);
    const acc = new Map<string, Record<string, MonthCost>>();

    const add = (clientId: string, month: string, hours: number, cost: number) => {
        if (!wanted.has(month) || hours <= 0) return;
        const m = acc.get(clientId) ?? {};
        const cur = m[month] ?? { hours: 0, cost: 0 };
        cur.hours += hours; cur.cost += cost;
        m[month] = cur;
        acc.set(clientId, m);
    };

    // Stessa data del report: scadenza del task, altrimenti ultimo aggiornamento
    for (const t of input.tasks) {
        const month = monthOf(t.dueDate) ?? monthOf(t.updatedAt);
        if (!month || !t.clientId) continue;
        const { hours, cost } = taskCost(t, input.usersById);
        add(t.clientId, month, hours, cost);
    }
    // Un'attività con più clienti si divide in parti uguali
    for (const a of input.activities) {
        const month = monthOf(a.startTime ?? a.start);
        const clients = activityClientIds(a);
        if (!month || clients.length === 0) continue;
        const { hours, cost } = activityCost(a, input.usersById);
        for (const c of clients) add(c, month, hours / clients.length, cost / clients.length);
    }

    const clients: ClientLabour[] = Array.from(acc.entries()).map(([clientId, byMonth]) => {
        const sum = (f: 'cost' | 'hours') => months.reduce((s, m) => s + (byMonth[m]?.[f] ?? 0), 0);
        const cur = byMonth[current] ?? { hours: 0, cost: 0 };
        return {
            clientId,
            name: input.clientNames[clientId] ?? 'Cliente sconosciuto',
            byMonth: Object.fromEntries(Object.entries(byMonth).map(([m, v]) => [m, { hours: r2(v.hours), cost: r2(v.cost) }])),
            monthlyCost: r2(sum('cost') / months.length),
            monthlyHours: r2(sum('hours') / months.length),
            currentMonth: { hours: r2(cur.hours), cost: r2(cur.cost) },
        };
    }).sort((a, b) => b.monthlyCost - a.monthlyCost || b.currentMonth.cost - a.currentMonth.cost);

    // I totali si sommano dai valori non arrotondati: sommare i valori già arrotondati per cliente sposta i centesimi
    const raw = (f: 'cost' | 'hours', ms: string[]) => Array.from(acc.values()).reduce((s, byMonth) => s + ms.reduce((t, m) => t + (byMonth[m]?.[f] ?? 0), 0), 0);
    return {
        months, current, clients,
        total: {
            monthlyCost: r2(raw('cost', months) / months.length),
            monthlyHours: r2(raw('hours', months) / months.length),
            currentMonth: { hours: r2(raw('hours', [current])), cost: r2(raw('cost', [current])) },
        },
    };
}
