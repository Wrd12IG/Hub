/**
 * lib/approval-board.ts
 *
 * La scheda «Approvazioni» del Piano editoriale: chi deve muoversi, e da quanto tempo. Pura (nessun I/O).
 * A differenza del riquadro «Da chiudere» della dashboard, qui si vede anche chi ha scritto da poco: l'attesa conta,
 * ma la scheda serve a guardare tutto, non solo ciò che è già in ritardo.
 */
import type { EditorialContent } from './data';

export interface BoardItem { content: EditorialContent; daysWaiting: number }

export interface ApprovalBoard {
    /** Il cliente ha chiesto modifiche: tocca a noi. */
    changes: BoardItem[];
    /** Mandati al cliente, senza risposta. */
    waiting: BoardItem[];
}

const DAY = 86_400_000;

function daysSince(iso: string | undefined, now: Date): number {
    const t = iso ? Date.parse(iso) : NaN;
    return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now.getTime() - t) / DAY));
}

/** Dal più fermo al più recente. Non conta ciò che è già pubblicato. `clientId` restringe a un cliente. */
export function approvalBoard(contents: EditorialContent[], now: Date, clientId?: string | null): ApprovalBoard {
    const open = contents.filter((c) => c.status !== 'Pubblicato' && (!clientId || c.clientId === clientId));
    const items = (status: 'changes' | 'requested'): BoardItem[] =>
        open
            .filter((c) => c.approval?.status === status)
            .map((c) => ({ content: c, daysWaiting: daysSince(status === 'changes' ? c.approval?.respondedAt || c.approval?.requestedAt : c.approval?.requestedAt, now) }))
            .sort((a, b) => b.daysWaiting - a.daysWaiting);
    return { changes: items('changes'), waiting: items('requested') };
}
