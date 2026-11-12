/**
 * lib/client-archive.ts
 *
 * Archiviare un cliente: smette di essere «attivo» senza perdere niente. Si può riattivare.
 *
 * Cosa si ferma davvero (non basta nasconderlo):
 *  - controlli automatici: task ricorrenti, riscaldamento dei report, raccolta competitor, pubblicazione programmata;
 *  - mail mensile dei KPI (il flag si spegne e si ricorda, alla riattivazione torna com'era);
 *  - link pubblico del report e area cliente: il link non risponde, gli accessi con ruolo Cliente si bloccano.
 * Cosa NON cambia: task, progetti, contenuti, ore e budget restano, e i task conservano il nome del cliente nello storico.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export const isArchivedDoc = (data?: { archived?: unknown } | null) => data?.archived === true;

/** Id dei clienti archiviati: serve ai controlli automatici per saltarli. */
export async function archivedClientIds(db: Firestore): Promise<Set<string>> {
  const snap = await db.collection('clients').where('archived', '==', true).select().get();
  return new Set(snap.docs.map((d) => d.id));
}

type AuthLike = { updateUser: (uid: string, p: { disabled: boolean }) => Promise<unknown>; revokeRefreshTokens: (uid: string) => Promise<unknown> };

export type ArchiveResult = { blockedUsers: number; restoredUsers: number };

async function setClientUsers(db: Firestore, auth: AuthLike, clientId: string, archive: boolean): Promise<number> {
  const users = await db.collection('users').where('clientId', '==', clientId).get();
  let n = 0;
  for (const u of users.docs) {
    if (archive) {
      if (u.get('status') === 'Inattivo') continue; // già bloccato da qualcuno: non è nostro da riaprire
      await auth.updateUser(u.id, { disabled: true }).then(() => auth.revokeRefreshTokens(u.id)).catch(() => {});
      await u.ref.update({ status: 'Inattivo', archivedWithClient: true, updatedAt: new Date().toISOString() });
      n++;
    } else if (u.get('archivedWithClient') === true) {
      await auth.updateUser(u.id, { disabled: false }).catch(() => {});
      await u.ref.update({ status: 'Attivo', archivedWithClient: FieldValue.delete(), updatedAt: new Date().toISOString() });
      n++;
    }
  }
  return n;
}

export async function setClientArchived(db: Firestore, auth: AuthLike, clientId: string, archived: boolean): Promise<ArchiveResult> {
  const ref = db.collection('clients').doc(clientId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('not-found');
  const data = snap.data() as { archived?: boolean; monthlyKpiMail?: boolean; archivedMonthlyKpiMail?: boolean };
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (archived) {
    patch.archived = true;
    patch.archivedAt = new Date().toISOString();
    if (data.monthlyKpiMail === true) { patch.monthlyKpiMail = false; patch.archivedMonthlyKpiMail = true; }
  } else {
    patch.archived = FieldValue.delete();
    patch.archivedAt = FieldValue.delete();
    if (data.archivedMonthlyKpiMail === true) { patch.monthlyKpiMail = true; patch.archivedMonthlyKpiMail = FieldValue.delete(); }
  }
  await ref.update(patch as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);
  const touched = await setClientUsers(db, auth, clientId, archived);
  return archived ? { blockedUsers: touched, restoredUsers: 0 } : { blockedUsers: 0, restoredUsers: touched };
}
