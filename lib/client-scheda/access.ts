/**
 * lib/client-scheda/access.ts
 *
 * Chi vede la scheda di un cliente: gli amministratori tutti i clienti; Project Manager e Collaboratore solo quelli in cui sono
 * responsabili (managedBy, socialManagerId) o PM di backup. Il ruolo Cliente mai. Pura: i dati arrivano da fuori.
 */
import type { ClientAssignees, Role } from './types';

export function assigneeIds(client: ClientAssignees): string[] {
    return [...(client.managedBy ?? []), client.socialManagerId, client.backupManagerId].filter((x): x is string => !!x);
}

export function canAccessScheda(user: { id: string; role?: Role; status?: string } | null, client: ClientAssignees): boolean {
    if (!user || !user.role || user.role === 'Cliente') return false;
    if (user.status === 'Inattivo') return false;
    if (user.role === 'Amministratore') return true;
    return assigneeIds(client).includes(user.id);
}

export const canDecideApproval = (user: { role?: Role; status?: string } | null) => user?.role === 'Amministratore' && user.status !== 'Inattivo';

/** Il backup deve essere uno staff diverso dai responsabili principali. Restituisce il motivo del rifiuto, o null se va bene. */
export function validateBackupManager(backupId: string | undefined | null, client: ClientAssignees, users: Array<{ id: string; role?: Role; status?: string }>): string | null {
    if (!backupId) return null;
    const u = users.find((x) => x.id === backupId);
    if (!u || u.role === 'Cliente') return 'Il PM di backup deve essere un utente dello staff.';
    if (u.status === 'Inattivo') return 'Il PM di backup non è attivo.';
    if ((client.managedBy ?? []).includes(backupId) || client.socialManagerId === backupId) return 'Il PM di backup deve essere diverso dal responsabile.';
    return null;
}
