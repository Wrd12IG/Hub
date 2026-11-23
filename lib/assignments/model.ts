/**
 * lib/assignments/model.ts
 *
 * Assegnazioni cliente → referente e utente → backup. Dati nuovi, separati da `managedBy` (che altre parti dell'app usano per notifiche e
 * scheda cliente): finché non si attiva la nuova visibilità dei task (1° gennaio 2027) l'importazione non cambia nessun comportamento.
 *
 *  - clients/{id}.referenteId   : UN referente per cliente (uid)
 *  - clients/{id}.peso, direzionale : carico di lavoro del cliente (dal foglio delle assegnazioni)
 *  - users/{uid}.backupUserId   : il collega che lo sostituisce su TUTTI i suoi clienti quando è assente
 */
export const ASSIGNMENTS_EFFECTIVE_FROM = '2027-01-01';

export interface AssignUser { id: string; name: string; role?: string; status?: string }
export interface AssignClient { id: string; name: string; referenteId?: string | null; peso?: number | null; direzionale?: boolean | null }

export interface SheetRow {
    /** Riga del foglio (1 = prima riga dopo l'intestazione), per i messaggi. */
    row: number;
    clientName: string;
    direzionale: boolean | null;
    peso: number | null;
    referente: string;
    backup: string;
}
