/**
 * lib/client-scheda/recipients.ts
 *
 * A chi arrivano notifiche ed email. Solo staff attivo con un indirizzo; mai i clienti; un destinatario una volta sola.
 *  - Richiesta di approvazione: tutti gli amministratori attivi (tranne l'autore) + i responsabili del cliente. Il PM di backup
 *    li sostituisce quando tutti i responsabili risultano assenti oggi (assenza «Approvato» che copre la data) o non ce n'è nessuno.
 *  - Esito: chi ha scritto la riga.
 */
import type { AbsenceLike, ClientAssignees, StaffUser } from './types';

const day = (iso: string) => iso.slice(0, 10);

export function isAbsentOn(absences: AbsenceLike[], userId: string, today: Date): boolean {
    const d = today.toISOString().slice(0, 10);
    return absences.some((a) => a.userId === userId && a.status === 'Approvato' && day(a.startDate) <= d && d <= day(a.endDate));
}

const eligible = (u: StaffUser | undefined): u is StaffUser => !!u && !!u.email && u.role !== 'Cliente' && u.status !== 'Inattivo';

export function requestRecipients(
    users: StaffUser[], client: ClientAssignees, absences: AbsenceLike[], authorId: string, today: Date,
): StaffUser[] {
    const byId = new Map(users.map((u) => [u.id, u]));
    const admins = users.filter((u) => u.role === 'Amministratore');
    const responsibles = Array.from(new Set([...(client.managedBy ?? []), ...(client.socialManagerId ? [client.socialManagerId] : [])]));
    const present = responsibles.filter((id) => !isAbsentOn(absences, id, today));
    const backup = client.backupManagerId && (responsibles.length === 0 || present.length === 0) ? [client.backupManagerId] : [];
    const seen = new Set<string>();
    const out: StaffUser[] = [];
    for (const u of [...admins, ...present.map((id) => byId.get(id)), ...backup.map((id) => byId.get(id))]) {
        if (!eligible(u) || u.id === authorId || seen.has(u.id)) continue;
        seen.add(u.id);
        out.push(u);
    }
    return out;
}

export function decisionRecipient(users: StaffUser[], authorId: string, deciderId: string): StaffUser | null {
    if (authorId === deciderId) return null;
    const u = users.find((x) => x.id === authorId);
    return eligible(u) ? u : null;
}
