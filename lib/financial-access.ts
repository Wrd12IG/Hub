/**
 * lib/financial-access.ts
 *
 * Chi vede i dati finanziari dei clienti: budget e note riservate (clients/{id}/private/internal).
 *  - Amministratore: sempre;
 *  - Project Manager e Collaboratore: solo se il loro ruolo ha la spunta «Visualizza Budget e Costi» (`_view-financials`) in
 *    Admin → Permessi;
 *  - Cliente: mai.
 * Un solo punto di verità per server (route) e browser (menu, pagine), così non divergono.
 */
import type { Firestore } from 'firebase-admin/firestore';

export const FINANCIALS_KEY = '_view-financials';
/** Campi del cliente che contano come finanziari. */
export const FINANCIAL_CLIENT_FIELDS = ['budget', 'notes'] as const;

export function canSeeFinancials(role: string | undefined | null, rolePermissions?: string[] | null): boolean {
    if (role === 'Amministratore') return true;
    if (!role || role === 'Cliente') return false;
    return (rolePermissions || []).includes(FINANCIALS_KEY);
}

/** Lato server: legge i permessi del ruolo dal database (Admin SDK). */
export async function canViewFinancialsServer(db: Firestore, user: { role?: string } | null): Promise<boolean> {
    if (!user?.role) return false;
    if (user.role === 'Amministratore') return true;
    if (user.role === 'Cliente') return false;
    const snap = await db.collection('rolePermissions').doc(user.role).get();
    const perms = snap.exists ? (snap.data()?.permissions as string[] | undefined) : undefined;
    return canSeeFinancials(user.role, perms);
}

/** Toglie budget e note da un oggetto cliente (copia). */
export function withoutFinancials<T extends Record<string, any>>(obj: T): T {
    const out: Record<string, any> = { ...obj };
    for (const f of FINANCIAL_CLIENT_FIELDS) delete out[f];
    return out as T;
}
