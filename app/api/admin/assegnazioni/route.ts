/**
 * /api/admin/assegnazioni  (solo amministratori)
 *
 * GET  → utenti dello staff (con il loro backup) e clienti (con referente, peso, direzionale).
 * POST → { clientChanges, userChanges }: scrive referenteId/peso/direzionale sui clienti e backupUserId sugli utenti, dopo aver ricontrollato tutto.
 * Non tocca `managedBy` né altro: finché non si attiva la nuova visibilità dei task, l'importazione non cambia nessun comportamento.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { forbiddenResponse, getAppUser, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { validateApply } from '@/lib/assignments/apply';
import type { AssignClient, AssignUser } from '@/lib/assignments/model';

export const dynamic = 'force-dynamic';

async function admin(request: NextRequest) {
    const user = await verifyAuth(request);
    if (!user) return { error: unauthorizedResponse() };
    if ((await getAppUser(user.uid))?.role !== 'Amministratore') return { error: forbiddenResponse() };
    return { uid: user.uid };
}

async function load() {
    const [us, cs] = await Promise.all([adminDb.collection('users').get(), adminDb.collection('clients').get()]);
    const users = us.docs
        .map((d) => ({ id: d.id, name: String(d.get('name') ?? d.id).trim(), role: d.get('role') as string | undefined, status: d.get('status') as string | undefined, backupUserId: (d.get('backupUserId') as string | undefined) ?? null }))
        .filter((u) => u.role !== 'Cliente');
    const clients: AssignClient[] = cs.docs
        .map((d) => ({ id: d.id, name: String(d.get('name') ?? d.id).trim(), referenteId: (d.get('referenteId') as string | undefined) ?? null, peso: (d.get('peso') as number | undefined) ?? null, direzionale: (d.get('direzionale') as boolean | undefined) ?? null }))
        .sort((a, b) => a.name.localeCompare(b.name));
    return { users: users as Array<AssignUser & { backupUserId: string | null }>, clients };
}

export async function GET(request: NextRequest) {
    const a = await admin(request);
    if ('error' in a) return a.error;
    return NextResponse.json(await load());
}

export async function POST(request: NextRequest) {
    const a = await admin(request);
    if ('error' in a) return a.error;
    const body = await request.json().catch(() => ({}));
    const { users, clients } = await load();
    const check = validateApply(body, users, clients);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

    const now = new Date().toISOString();
    const batch = adminDb.batch();
    for (const w of check.clientWrites) {
        batch.update(adminDb.collection('clients').doc(w.clientId), { referenteId: w.referenteId, peso: w.peso, direzionale: w.direzionale, assignmentUpdatedAt: now });
    }
    for (const w of check.userWrites) {
        batch.update(adminDb.collection('users').doc(w.userId), { backupUserId: w.backupUserId, assignmentUpdatedAt: now });
    }
    await batch.commit();
    return NextResponse.json({ ok: true, clients: check.clientWrites.length, users: check.userWrites.length });
}
