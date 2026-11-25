/**
 * lib/brief-status.ts
 *
 * Il percorso di un brief, dall'invio alla consegna. Pura (nessun I/O).
 *
 *   Inviato → In Revisione → Approvato → In Lavorazione → Consegnato
 *   (valutazione)  (preso in carico)  (si lavora)   (chiuso)
 *
 * Prima il percorso si fermava a «Approvato» e nessuna schermata permetteva di cambiare stato: il cliente vedeva
 * «Inviato» per sempre. «Bozza» resta solo per i brief che lo staff prepara e non ha ancora mandato avanti.
 */
import type { Brief } from './data';

export type BriefStatus = Brief['status'];

/** Tutti gli stati, nell'ordine del percorso. */
export const BRIEF_STATUSES: readonly BriefStatus[] = ['Bozza', 'Inviato', 'In Revisione', 'Approvato', 'In Lavorazione', 'Consegnato'];

/** Come li legge il cliente. */
export const CLIENT_STATUS_LABEL: Record<BriefStatus, string> = {
    Bozza: 'In preparazione',
    Inviato: 'Inviato',
    'In Revisione': 'Il team lo sta valutando',
    Approvato: 'Preso in carico',
    'In Lavorazione': 'In lavorazione',
    Consegnato: 'Consegnato',
};

/** Le mosse che lo staff ha a disposizione dal menu del brief: etichetta dell'azione e stato di arrivo. */
export const STAFF_BRIEF_MOVES: readonly { to: BriefStatus; label: string }[] = [
    { to: 'In Revisione', label: 'Metti in valutazione' },
    { to: 'Approvato', label: 'Prendi in carico' },
    { to: 'In Lavorazione', label: 'Segna in lavorazione' },
    { to: 'Consegnato', label: 'Segna come consegnato' },
];

/** Il brief è ancora da portare a termine (non consegnato e non una semplice bozza). */
export function isBriefOpen(status: BriefStatus): boolean {
    return status !== 'Consegnato' && status !== 'Bozza';
}

/** Creare un progetto da un brief è «iniziare a lavorarci»: porta avanti solo chi non ci è ancora arrivato. */
export function statusAfterProjectCreated(status: BriefStatus): BriefStatus {
    return status === 'Inviato' || status === 'In Revisione' || status === 'Approvato' ? 'In Lavorazione' : status;
}

export interface BriefTodo {
    /** Inviati dal cliente e mai guardati. */
    toEvaluate: Brief[];
    /** Presi in carico o in lavorazione, da portare a «Consegnato». */
    inProgress: Brief[];
    /** Aperti con la scadenza già passata. */
    overdue: Brief[];
}

/** Cosa resta da chiudere nei brief. `today` è una data «yyyy-mm-dd». */
export function briefTodo(briefs: Brief[], today: string): BriefTodo {
    const byOldest = (a: Brief, b: Brief) => String(a.createdAt).localeCompare(String(b.createdAt));
    const open = briefs.filter((b) => isBriefOpen(b.status));
    return {
        toEvaluate: open.filter((b) => b.status === 'Inviato').sort(byOldest),
        inProgress: open.filter((b) => b.status === 'Approvato' || b.status === 'In Lavorazione').sort(byOldest),
        overdue: open.filter((b) => !!b.deadline && b.deadline.slice(0, 10) < today).sort((a, b) => String(a.deadline).localeCompare(String(b.deadline))),
    };
}
