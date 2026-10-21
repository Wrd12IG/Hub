/**
 * Campi interni del cliente che l'utente con ruolo Cliente non deve poter leggere.
 *
 * Il documento clients/{id} è leggibile dal cliente proprietario via SDK (firestore.rules), quindi i dati
 * riservati vivono in clients/{id}/private/{campo}, con regola «solo staff». La route /api/clients/[id]
 * (Admin SDK) li unisce al documento per lo staff e li scrive nel posto giusto: i componenti non cambiano.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Due forme di dato riservato:
 *  - campi «oggetto» (mediaPlan, postLead): un documento private/{campo} con il valore dentro;
 *  - campi «scalari» raggruppati: private/internal = { budget, notes }, private/publicLink = { publicToken, publicTokenCreatedAt }.
 * Il token pubblico ha in più un indice solo-server (publicTokens/{token} = { clientId }), per trovare il cliente dal link
 * senza interrogare il documento cliente: vedi lib/client-public-link.ts.
 */
export const OBJECT_PRIVATE_FIELDS = ['mediaPlan', 'postLead'] as const;
export const SCALAR_PRIVATE_GROUPS = {
  internal: ['budget', 'notes'],
  publicLink: ['publicToken', 'publicTokenCreatedAt'],
} as const;
export type ScalarPrivateGroup = keyof typeof SCALAR_PRIVATE_GROUPS;
export const SCALAR_PRIVATE_FIELDS = Object.values(SCALAR_PRIVATE_GROUPS).flat() as string[];

export const PRIVATE_CLIENT_FIELDS = [...OBJECT_PRIVATE_FIELDS, ...SCALAR_PRIVATE_FIELDS] as const;
export type PrivateClientField = (typeof OBJECT_PRIVATE_FIELDS)[number] | (typeof SCALAR_PRIVATE_FIELDS)[number];

const isObjectField = (f: string): f is (typeof OBJECT_PRIVATE_FIELDS)[number] => (OBJECT_PRIVATE_FIELDS as readonly string[]).includes(f);
const groupOf = (f: string): ScalarPrivateGroup | undefined =>
  (Object.keys(SCALAR_PRIVATE_GROUPS) as ScalarPrivateGroup[]).find((g) => (SCALAR_PRIVATE_GROUPS[g] as readonly string[]).includes(f));

/** Separa dal body i campi riservati (null = da eliminare) lasciando il resto. */
export function splitPrivateFields(body: Record<string, unknown>): {
  rest: Record<string, unknown>;
  privateFields: Partial<Record<PrivateClientField, unknown>>;
} {
  const rest = { ...body };
  const privateFields: Partial<Record<PrivateClientField, unknown>> = {};
  for (const f of PRIVATE_CLIENT_FIELDS) {
    if (f in rest) {
      privateFields[f] = rest[f];
      delete rest[f];
    }
  }
  return { rest, privateFields };
}

/**
 * Scrive i campi riservati in clients/{id}/private/{campo} e toglie l'eventuale copia rimasta nel documento
 * cliente (dati non ancora migrati), così una modifica non lascia dati sensibili esposti.
 */
export async function savePrivateFields(
  db: Firestore,
  clientId: string,
  privateFields: Partial<Record<PrivateClientField, unknown>>,
  clientUpdate: Record<string, unknown> = {},
): Promise<void> {
  const clientRef = db.collection('clients').doc(clientId);
  const batch = db.batch();
  const groupPatches: Partial<Record<ScalarPrivateGroup, Record<string, unknown>>> = {};
  for (const f of PRIVATE_CLIENT_FIELDS) {
    if (!(f in privateFields)) continue;
    const value = privateFields[f];
    if (isObjectField(f)) {
      const ref = clientRef.collection('private').doc(f);
      if (value && typeof value === 'object') batch.set(ref, value as FirebaseFirestore.DocumentData);
      else batch.delete(ref);
    } else {
      const g = groupOf(f)!;
      (groupPatches[g] ??= {})[f] = value == null || value === '' ? FieldValue.delete() : value;
    }
    clientUpdate[f] = FieldValue.delete();
  }
  for (const [g, patch] of Object.entries(groupPatches)) {
    batch.set(clientRef.collection('private').doc(g), patch as FirebaseFirestore.DocumentData, { merge: true });
  }
  batch.update(clientRef, clientUpdate as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);
  await batch.commit();
}

/** Campi riservati del cliente: sottocollezione private, con ripiego sul vecchio campo nel documento. */
export async function readPrivateFields(
  db: Firestore,
  clientId: string,
  legacy: Record<string, unknown> = {},
): Promise<Partial<Record<PrivateClientField, unknown>>> {
  const clientRef = db.collection('clients').doc(clientId);
  const docNames = [...OBJECT_PRIVATE_FIELDS, ...(Object.keys(SCALAR_PRIVATE_GROUPS) as ScalarPrivateGroup[])] as string[];
  const snaps = await Promise.all(docNames.map((n) => clientRef.collection('private').doc(n).get()));
  const byDoc: Record<string, Record<string, unknown> | undefined> = {};
  docNames.forEach((n, i) => { byDoc[n] = snaps[i].exists ? (snaps[i].data() as Record<string, unknown>) : undefined; });
  const out: Partial<Record<PrivateClientField, unknown>> = {};
  for (const f of PRIVATE_CLIENT_FIELDS) {
    const stored = isObjectField(f) ? byDoc[f] : byDoc[groupOf(f)!]?.[f];
    if (stored != null) out[f] = stored;
    else if (legacy[f] != null) out[f] = legacy[f];
  }
  return out;
}

/** Budget e note di tutti i clienti (una lettura sola, per la lista clienti dello staff). */
export async function readAllInternalFields(db: Firestore): Promise<Record<string, { budget?: number; notes?: string }>> {
  const snap = await db.collectionGroup('private').get();
  const out: Record<string, { budget?: number; notes?: string }> = {};
  for (const d of snap.docs) {
    if (d.id !== 'internal' || d.ref.parent.parent?.parent.id !== 'clients') continue;
    const { budget, notes } = d.data() as { budget?: number; notes?: string };
    out[d.ref.parent.parent.id] = { budget, notes };
  }
  return out;
}
