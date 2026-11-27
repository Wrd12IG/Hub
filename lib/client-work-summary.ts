// Riepilogo del lavoro aperto su un cliente, per la testata della scheda cliente:
// quanti task da fare, scaduti, in approvazione interna e in attesa del cliente. Pura.

export interface ClientWorkSummary {
    open: number;
    overdue: number;
    inApproval: number;
    waitingClient: number;
}

type TaskLike = { clientId?: string | null; status: string; dueDate?: string | null };

const CLOSED = new Set(['Approvato', 'Annullato']);

export function clientWorkSummary(tasks: TaskLike[], clientId: string, today: Date = new Date()): ClientWorkSummary {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const out: ClientWorkSummary = { open: 0, overdue: 0, inApproval: 0, waitingClient: 0 };
    for (const t of tasks) {
        if (t.clientId !== clientId || CLOSED.has(t.status)) continue;
        out.open++;
        if (t.status === 'In Approvazione') out.inApproval++;
        if (t.status === 'In Approvazione Cliente') out.waitingClient++;
        // stessa regola del kanban: scaduto vale per ciò che è ancora da fare o in lavorazione
        if ((t.status === 'Da Fare' || t.status === 'In Lavorazione') && t.dueDate) {
            const due = new Date(t.dueDate);
            due.setHours(0, 0, 0, 0);
            if (due < start) out.overdue++;
        }
    }
    return out;
}
