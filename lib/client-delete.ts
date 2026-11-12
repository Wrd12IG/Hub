/**
 * lib/client-delete.ts
 *
 * Eliminazione di un cliente con tutto ciò che gli appartiene. Prima «Elimina» cancellava solo la scheda: restavano budget e
 * note riservate, token delle integrazioni (Meta, Google…), link pubblico del report e tutti i task, progetti, contenuti e
 * brief collegati, senza più un cliente a cui riferirsi.
 *
 * Due funzioni sullo stesso elenco di raccolte, così ciò che la conferma dice («sparirà questo») e ciò che si cancella
 * davvero non possono divergere:
 *  - clientImpact(): conta, non tocca niente;
 *  - deleteClientCascade(): cancella.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { PUBLIC_TOKENS } from '@/lib/client-public-link';

/** Raccolte di primo livello con un campo `clientId` singolo: i documenti spariscono con il cliente. */
export const OWNED_BY_CLIENT = [
  { collection: 'tasks', label: 'task' },
  { collection: 'projects', label: 'progetti' },
  { collection: 'editorialContents', label: 'contenuti del piano editoriale' },
  { collection: 'briefs', label: 'brief' },
  { collection: 'recurringTasks', label: 'task ricorrenti' },
] as const;

export type ClientImpact = {
  counts: { label: string; count: number }[];
  /** Attività di calendario condivise con altri clienti: restano, perde solo questo cliente. */
  sharedActivities: number;
  /** Utenti con ruolo Cliente collegati: non vengono cancellati, ma perdono l'accesso. */
  clientUsers: { id: string; name: string; email: string }[];
  hasPublicLink: boolean;
  hasIntegrations: boolean;
};

async function calendarSplit(db: Firestore, clientId: string) {
  const [single, multi] = await Promise.all([
    db.collection('calendarActivities').where('clientId', '==', clientId).get(),
    db.collection('calendarActivities').where('clientIds', 'array-contains', clientId).get(),
  ]);
  const own: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  const shared: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  const seen = new Set<string>();
  for (const d of [...single.docs, ...multi.docs]) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    const data = d.data() as { clientId?: string; clientIds?: string[] };
    const others = new Set<string>([...(data.clientIds ?? []), ...(data.clientId ? [data.clientId] : [])]);
    others.delete(clientId);
    (others.size > 0 ? shared : own).push(d);
  }
  return { own, shared };
}

export async function clientImpact(db: Firestore, clientId: string): Promise<ClientImpact> {
  const clientRef = db.collection('clients').doc(clientId);
  const [owned, cal, users, link, integrations] = await Promise.all([
    Promise.all(OWNED_BY_CLIENT.map((o) => db.collection(o.collection).where('clientId', '==', clientId).get())),
    calendarSplit(db, clientId),
    db.collection('users').where('clientId', '==', clientId).get(),
    clientRef.collection('private').doc('publicLink').get(),
    clientRef.collection('integrations').limit(1).get(),
  ]);
  const counts: { label: string; count: number }[] = OWNED_BY_CLIENT.map((o, i) => ({ label: o.label, count: owned[i].size }));
  counts.push({ label: 'attività di calendario', count: cal.own.length });
  return {
    counts: counts.filter((c) => c.count > 0),
    sharedActivities: cal.shared.length,
    clientUsers: users.docs.map((u) => ({ id: u.id, name: String(u.get('name') ?? ''), email: String(u.get('email') ?? '') })),
    hasPublicLink: link.exists,
    hasIntegrations: !integrations.empty,
  };
}

async function deleteDocs(db: Firestore, docs: FirebaseFirestore.QueryDocumentSnapshot[]) {
  for (let i = 0; i < docs.length; i += 400) {
    const batch = db.batch();
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * Cancella il cliente. Ordine pensato per fermarsi bene: prima si chiude ciò che dà accesso dall'esterno (link pubblico),
 * poi i dati collegati, per ultima la scheda — se qualcosa si interrompe a metà, il cliente esiste ancora e si può rifare.
 * Restituisce gli utenti Cliente da disattivare: l'account di accesso lo gestisce chi chiama (ha l'Auth, non il database).
 */
export async function deleteClientCascade(db: Firestore, clientId: string): Promise<{ clientUserIds: string[]; removed: Record<string, number> }> {
  const clientRef = db.collection('clients').doc(clientId);
  const removed: Record<string, number> = {};

  // 1. Link pubblico: toglie il token dall'indice (chiunque lo abbia non vede più il report).
  const [link, legacy] = await Promise.all([clientRef.collection('private').doc('publicLink').get(), clientRef.get()]);
  const tokens = new Set<string>();
  const t1 = link.data()?.publicToken; if (typeof t1 === 'string') tokens.add(t1);
  const t2 = legacy.data()?.publicToken; if (typeof t2 === 'string') tokens.add(t2);
  await Promise.all(Array.from(tokens).map((t) => db.collection(PUBLIC_TOKENS).doc(t).delete()));

  // 2. Dati collegati nelle raccolte di primo livello.
  for (const o of OWNED_BY_CLIENT) {
    const snap = await db.collection(o.collection).where('clientId', '==', clientId).get();
    await deleteDocs(db, snap.docs);
    removed[o.collection] = snap.size;
  }
  const cal = await calendarSplit(db, clientId);
  await deleteDocs(db, cal.own);
  removed.calendarActivities = cal.own.length;
  for (const d of cal.shared) {
    const data = d.data() as { clientId?: string; clientIds?: string[] };
    const patch: Record<string, unknown> = { clientIds: FieldValue.arrayRemove(clientId) };
    if (data.clientId === clientId) patch.clientId = FieldValue.delete();
    await d.ref.update(patch);
  }

  // 3. Utenti con ruolo Cliente: li lascia al chiamante (account di accesso).
  const users = await db.collection('users').where('clientId', '==', clientId).get();

  // 4. La scheda con tutte le sue sotto-raccolte (private, integrations con i token, rapporti, commenti, cache).
  await db.recursiveDelete(clientRef);
  return { clientUserIds: users.docs.map((u) => u.id), removed };
}
