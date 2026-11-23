/**
 * lib/client-archive.ts
 *
 * Un cliente non più seguito si archivia, non si elimina: «Elimina» cancella anche task, progetti, contenuti, brief e
 * attività di calendario collegati (vedi lib/client-delete.ts), mentre l'archivio conserva tutto lo storico.
 *
 * Un cliente archiviato:
 *  - resta nell'elenco completo (`clients`, `clientsById`), così task, progetti e report passati continuano a mostrarne il nome;
 *  - sparisce da elenchi di lavoro e selettori (`activeClients`) e dalla pagina Assegnazioni;
 *  - non conta tra i clienti «senza referente»;
 *  - si ripristina in qualsiasi momento da Admin → Clienti.
 */

export type ArchivableClient = { archived?: boolean | null };

/** Vero se il cliente è archiviato. Un documento senza il campo (tutti quelli esistenti) è attivo. */
export function isArchivedClient(c: ArchivableClient | null | undefined): boolean {
    return c?.archived === true;
}

/** Solo i clienti attivi: da usare per elenchi di lavoro e selettori. */
export function activeOnly<T extends ArchivableClient>(clients: readonly T[]): T[] {
    return clients.filter((c) => !isArchivedClient(c));
}

/**
 * Clienti scegliibili in un menu: gli attivi, più quelli già selezionati (di solito uno). Senza `keepIds` un task o un progetto
 * di un cliente archiviato aprirebbe la modifica con il campo cliente vuoto, e salvandolo lo perderebbe.
 */
export function selectableClients<T extends ArchivableClient & { id: string }>(clients: readonly T[], ...keepIds: Array<string | null | undefined>): T[] {
    return clients.filter((c) => !isArchivedClient(c) || keepIds.includes(c.id));
}

/** Campi da scrivere sul documento per archiviare o ripristinare. Ripristinare mette i campi a null: isArchivedClient() li legge come «attivo». */
export function archivePatch(archived: boolean, nowIso: string): { archived: boolean | null; archivedAt: string | null; updatedAt: string } {
    return archived
        ? { archived: true, archivedAt: nowIso, updatedAt: nowIso }
        : { archived: null, archivedAt: null, updatedAt: nowIso };
}
