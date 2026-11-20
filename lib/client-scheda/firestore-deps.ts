/**
 * lib/client-scheda/firestore-deps.ts
 *
 * Le dipendenze vere della scheda cliente: Firestore (Admin SDK), notifiche in app, email via SMTP. Solo server.
 * Righe in clients/{id}/contactLog (scritte solo da qui). Nessuna email parte da nessun'altra parte.
 */
import { adminDb } from '@/lib/firebase-admin';
import { canViewFinancialsServer } from '@/lib/financial-access';
import { notifyUsers } from '@/lib/server-notify';
import type { SchedaDeps } from './service';
import type { AbsenceLike, LogEntry, StaffUser } from './types';

const FROM_NAME = 'W[r]Digital Hub';
const FROM_ADDRESS = 'hub@wrdigital.it';

const logs = (clientId: string) => adminDb.collection('clients').doc(clientId).collection('contactLog');

export function baseUrlFromEnv(): string {
    return (process.env.NEXT_PUBLIC_APP_URL || 'https://hub.wrdigital.it').replace(/\/$/, '');
}

export function firestoreSchedaDeps(): SchedaDeps {
    return {
        async loadClient(id) {
            const s = await adminDb.collection('clients').doc(id).get();
            return s.exists ? (s.data() as Record<string, unknown>) : null;
        },
        async loadUsers() {
            const s = await adminDb.collection('users').get();
            return s.docs.map((d) => ({ id: d.id, name: String(d.get('name') ?? d.id), email: d.get('email'), role: d.get('role'), status: d.get('status') }) as StaffUser);
        },
        async loadNotes(id) {
            const s = await adminDb.collection('clients').doc(id).collection('private').doc('internal').get();
            return s.exists ? s.get('notes') : null;
        },
        canSeeNotes: (role) => canViewFinancialsServer(adminDb, { role }),
        async loadAbsences() {
            const s = await adminDb.collection('absences').where('status', '==', 'Approvato').get();
            return s.docs.map((d) => d.data() as AbsenceLike);
        },
        async listLogs(clientId, { limit, before, pendingOnly }) {
            if (pendingOnly) {
                // Filtro su un solo campo, senza ordinamento: non richiede indici composti. Si ordina qui.
                const s = await logs(clientId).where('approval.status', '==', 'in_attesa').limit(limit).get();
                return s.docs.map((d) => ({ id: d.id, ...d.data() }) as LogEntry).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
            }
            let q = logs(clientId).orderBy('createdAt', 'desc');
            if (before) q = q.startAfter(before);
            const s = await q.limit(limit).get();
            return s.docs.map((d) => ({ id: d.id, ...d.data() }) as LogEntry);
        },
        async addLog(clientId, entry) {
            const ref = await logs(clientId).add(entry);
            return ref.id;
        },
        async decideLog(clientId, logId, compute) {
            const ref = logs(clientId).doc(logId);
            return adminDb.runTransaction(async (tx) => {
                const snap = await tx.get(ref);
                if (!snap.exists) return { kind: 'not_found' as const };
                const entry = { id: snap.id, ...snap.data() } as LogEntry;
                const r = compute(entry);
                if (!r.ok) return { kind: 'rejected' as const, error: r.error };
                tx.update(ref, { approval: r.value });
                return { kind: 'done' as const, entry, approval: r.value };
            });
        },
        async notify(userIds, n) {
            await notifyUsers(userIds, { title: n.title, text: n.text, type: n.type, category: 'system', priority: 'high', link: n.link, resourceId: n.resourceId, resourceType: 'client_log' });
        },
        async sendEmail(to, m) {
            const { sendEmailServerAction } = await import('@/lib/email-server');
            return sendEmailServerAction(to.email, to.name, m.subject, m.html, FROM_NAME, FROM_ADDRESS);
        },
        now: () => new Date(),
        baseUrl: baseUrlFromEnv(),
    };
}
