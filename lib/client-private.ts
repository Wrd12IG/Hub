/**
 * Campi interni del cliente che l'utente con ruolo Cliente non deve poter leggere.
 *
 * Il documento clients/{id} è leggibile dal cliente proprietario via SDK (firestore.rules), quindi i dati
 * riservati vivono in clients/{id}/private/{campo}, con regola «solo staff». La route /api/clients/[id]
 * (Admin SDK) li unisce al documento per lo staff e li scrive nel posto giusto: i componenti non cambiano.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export const PRIVATE_CLIENT_FIELDS = ['mediaPlan', 'postLead'] as const;
export type PrivateClientField = (typeof PRIVATE_CLIENT_FIELDS)[number];

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
  for (const f of PRIVATE_CLIENT_FIELDS) {
    if (!(f in privateFields)) continue;
    const ref = clientRef.collection('private').doc(f);
    const value = privateFields[f];
    if (value && typeof value === 'object') batch.set(ref, value as FirebaseFirestore.DocumentData);
    else batch.delete(ref);
    clientUpdate[f] = FieldValue.delete();
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
  const snaps = await Promise.all(PRIVATE_CLIENT_FIELDS.map((f) => clientRef.collection('private').doc(f).get()));
  const out: Partial<Record<PrivateClientField, unknown>> = {};
  PRIVATE_CLIENT_FIELDS.forEach((f, i) => {
    if (snaps[i].exists) out[f] = snaps[i].data();
    else if (legacy[f] != null) out[f] = legacy[f];
  });
  return out;
}
