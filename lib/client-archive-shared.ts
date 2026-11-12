/**
 * lib/client-archive-shared.ts
 *
 * Lato app (browser) dell'archivio clienti: quali clienti proporre. La parte server è in lib/client-archive.ts.
 * Regola: un cliente archiviato non si propone per CREARE lavoro nuovo (task, progetti, brief, contenuti…), ma resta
 * ovunque serva a leggere lo storico (nomi, filtri, report).
 */
export const isArchivedClient = (c?: { archived?: boolean } | null) => c?.archived === true;

/** Clienti da proporre in un menu di scelta. `keepId`: il cliente già scelto, anche se archiviato (si sta modificando). */
export function pickableClients<T extends { id: string; archived?: boolean }>(clients: T[], keepId?: string | null): T[] {
    return clients.filter((c) => !isArchivedClient(c) || (!!keepId && c.id === keepId));
}
