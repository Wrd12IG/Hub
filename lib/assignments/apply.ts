/**
 * lib/assignments/apply.ts
 *
 * Controllo, lato server, di ciò che la pagina vuole scrivere: la pagina mostra l'anteprima, ma il server non si fida e ricontrolla tutto.
 * Pura. Restituisce solo i campi consentiti, ripuliti.
 */
import type { AssignClient, AssignUser } from './model';

export interface ClientWrite { clientId: string; referenteId: string; peso: number | null; direzionale: boolean | null }
export interface UserWrite { userId: string; backupUserId: string }
export interface ApplyBody { clientChanges?: unknown; userChanges?: unknown }
export type ApplyCheck = { ok: true; clientWrites: ClientWrite[]; userWrites: UserWrite[] } | { ok: false; error: string };

export const MAX_WRITES = 200;

export function validateApply(body: ApplyBody, users: AssignUser[], clients: AssignClient[]): ApplyCheck {
    const cc = Array.isArray(body?.clientChanges) ? body.clientChanges : [];
    const uc = Array.isArray(body?.userChanges) ? body.userChanges : [];
    if (cc.length + uc.length === 0) return { ok: false, error: 'Niente da scrivere.' };
    if (cc.length > MAX_WRITES || uc.length > MAX_WRITES) return { ok: false, error: 'Troppe modifiche in una volta.' };
    const userById = new Map(users.map((u) => [u.id, u]));
    const clientIds = new Set(clients.map((c) => c.id));
    const activeStaff = (id: unknown) => { const u = typeof id === 'string' ? userById.get(id) : undefined; return !!u && u.role !== 'Cliente' && u.status !== 'Inattivo'; };

    const clientWrites: ClientWrite[] = [];
    const seenClients = new Set<string>();
    for (const raw of cc) {
        const r = (raw || {}) as Record<string, unknown>;
        if (typeof r.clientId !== 'string' || !clientIds.has(r.clientId)) return { ok: false, error: 'Cliente non valido.' };
        if (seenClients.has(r.clientId)) return { ok: false, error: 'Un cliente compare due volte.' };
        seenClients.add(r.clientId);
        if (!activeStaff(r.referenteId)) return { ok: false, error: 'Il referente deve essere uno staff attivo.' };
        const peso = r.peso === null || r.peso === undefined ? null : Number(r.peso);
        if (peso !== null && (!Number.isFinite(peso) || peso < 0 || peso > 1000)) return { ok: false, error: 'Peso non valido.' };
        const dir = r.direzionale === null || r.direzionale === undefined ? null : r.direzionale;
        if (dir !== null && typeof dir !== 'boolean') return { ok: false, error: 'Direzionale non valido.' };
        clientWrites.push({ clientId: r.clientId, referenteId: r.referenteId as string, peso, direzionale: dir });
    }
    const userWrites: UserWrite[] = [];
    const seenUsers = new Set<string>();
    for (const raw of uc) {
        const r = (raw || {}) as Record<string, unknown>;
        if (!activeStaff(r.userId) || !activeStaff(r.backupUserId)) return { ok: false, error: 'Utente o backup non valido: devono essere staff attivo.' };
        if (r.userId === r.backupUserId) return { ok: false, error: 'Un utente non può essere il backup di se stesso.' };
        if (seenUsers.has(r.userId as string)) return { ok: false, error: 'Un utente compare due volte.' };
        seenUsers.add(r.userId as string);
        userWrites.push({ userId: r.userId as string, backupUserId: r.backupUserId as string });
    }
    return { ok: true, clientWrites, userWrites };
}
