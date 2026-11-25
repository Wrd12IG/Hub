/**
 * lib/task-model.ts
 *
 * Il metodo dei task dell'agenzia: cinque stati, quattro priorità, un modo di chiamare le cose. Pura (nessun I/O).
 * Perché ogni regola sta così: docs/gestione-task.md.
 *
 * I VALORI salvati nel database non cambiano (nessuna migrazione): cambia come si mostrano e cosa si offre.
 *  - «In Approvazione Cliente» si legge «In attesa cliente»: la palla è del cliente (approvazione o materiali);
 *  - «Annullato» non è più uno dei cinque stati del flusso: è l'ARCHIVIO («non più necessario»). Il codice lo continua a
 *    usare per escludere quei task da ore, costi e statistiche, e per la data di annullamento: per questo non sparisce.
 */
import type { Task } from './data';

export type TaskStatus = Task['status'];
export type TaskPriority = Task['priority'];

/** I cinque stati del flusso, nell'ordine in cui un task li attraversa. */
export const FLOW_STATUSES: readonly TaskStatus[] = ['Da Fare', 'In Lavorazione', 'In Approvazione', 'In Approvazione Cliente', 'Approvato'];

/** Il valore dell'archivio. Fuori dal flusso. */
export const ARCHIVED_STATUS: TaskStatus = 'Annullato';

export const STATUS_LABEL: Record<TaskStatus, string> = {
    'Da Fare': 'Da Fare',
    'In Lavorazione': 'In Lavorazione',
    'In Approvazione': 'In Approvazione',
    'In Approvazione Cliente': 'In attesa cliente',
    Approvato: 'Approvato',
    Annullato: 'Archiviato',
};

/** Come si scrive uno stato a schermo. Un valore sconosciuto si mostra com'è. */
export function statusLabel(status: string | null | undefined): string {
    if (!status) return '';
    return (STATUS_LABEL as Record<string, string>)[status] ?? status;
}

/** La voce che mette un task in archivio: nel menu dello stato sta sotto ai cinque stati, separata. */
export const ARCHIVE_ACTION_LABEL = 'Archivia (non più necessario)';

export const isArchivedTask = (t: Pick<Task, 'status'>): boolean => t.status === ARCHIVED_STATUS;
/** Chiuso = non c'è più nulla da fare: approvato o archiviato. */
export const isClosedTask = (t: Pick<Task, 'status'>): boolean => t.status === 'Approvato' || t.status === ARCHIVED_STATUS;

/** Quando la palla è del cliente, non è un ritardo nostro: nessun sollecito di scadenza e nessuna colpa al responsabile. */
export const isWaitingOnClient = (t: Pick<Task, 'status'>): boolean => t.status === 'In Approvazione Cliente';

/** Dopo quanti giorni senza risposta il cliente va sollecitato. */
export const CLIENT_WAIT_REMINDER_DAYS = 3;

/** Quante priorità «Critica» al massimo per persona: se tutto è critico, niente lo è. */
export const MAX_CRITICAL_PER_PERSON = 2;

export const PRIORITY_RULES: Record<TaskPriority, string> = {
    Critica: `Qualcosa è fermo ora (campagna, sito, tracciamento, spesa che brucia). Si fa oggi; al massimo ${MAX_CRITICAL_PER_PERSON} a persona.`,
    Alta: 'Scade entro 3 giorni lavorativi, oppure incide sui risultati del cliente questa settimana.',
    Media: 'Lavoro pianificato. È il valore normale, anche per i task ricorrenti.',
    Bassa: 'Utile ma senza una scadenza vera: si fa nei buchi.',
};

/** Priorità di un task nuovo. */
export const DEFAULT_PRIORITY: TaskPriority = 'Media';
