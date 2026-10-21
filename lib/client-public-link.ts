/**
 * Link pubblico del cliente (/share/client/[token]).
 *
 * Il token sta in clients/{id}/private/publicLink (solo staff), non nel documento cliente che il Cliente può leggere.
 * Per risalire al cliente dal token, senza indice di gruppo da pubblicare, c'è un documento solo-server
 * publicTokens/{token} = { clientId }: le regole lo negano a chi non è staff, e la route pubblica usa l'Admin SDK.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export const PUBLIC_TOKENS = 'publicTokens';

/** Genera un nuovo token (revocando l'eventuale precedente) e aggiorna scheda riservata e indice nello stesso batch. */
export async function createPublicLink(db: Firestore, clientId: string): Promise<{ token: string; createdAt: string }> {
  const clientRef = db.collection('clients').doc(clientId);
  const linkRef = clientRef.collection('private').doc('publicLink');
  const previous = (await linkRef.get()).data()?.publicToken as string | undefined;
  const token = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const batch = db.batch();
  if (previous) batch.delete(db.collection(PUBLIC_TOKENS).doc(previous));
  batch.set(db.collection(PUBLIC_TOKENS).doc(token), { clientId, createdAt });
  batch.set(linkRef, { publicToken: token, publicTokenCreatedAt: createdAt });
  batch.update(clientRef, { publicToken: FieldValue.delete(), publicTokenCreatedAt: FieldValue.delete(), updatedAt: createdAt });
  await batch.commit();
  return { token, createdAt };
}

/** Revoca il link: toglie token, scheda riservata e indice. Anche un token rimasto nel vecchio campo del documento. */
export async function revokePublicLink(db: Firestore, clientId: string): Promise<void> {
  const clientRef = db.collection('clients').doc(clientId);
  const linkRef = clientRef.collection('private').doc('publicLink');
  const [link, client] = await Promise.all([linkRef.get(), clientRef.get()]);
  const tokens = new Set<string>();
  const t1 = link.data()?.publicToken; if (typeof t1 === 'string') tokens.add(t1);
  const t2 = client.data()?.publicToken; if (typeof t2 === 'string') tokens.add(t2);
  const batch = db.batch();
  tokens.forEach((t) => batch.delete(db.collection(PUBLIC_TOKENS).doc(t)));
  batch.delete(linkRef);
  batch.update(clientRef, { publicToken: FieldValue.delete(), publicTokenCreatedAt: FieldValue.delete(), updatedAt: new Date().toISOString() });
  await batch.commit();
}

/**
 * Cliente a cui appartiene il token, o null. Prima l'indice; se manca, il vecchio campo nel documento (dati non ancora
 * migrati) così i link già condivisi continuano a funzionare durante la migrazione.
 */
export async function findClientByPublicToken(db: Firestore, token: string): Promise<{ id: string; data: Record<string, any> } | null> {
  const idx = await db.collection(PUBLIC_TOKENS).doc(token).get();
  const clientId = idx.exists ? (idx.data()?.clientId as string | undefined) : undefined;
  if (clientId) {
    const [client, link] = await Promise.all([
      db.collection('clients').doc(clientId).get(),
      db.collection('clients').doc(clientId).collection('private').doc('publicLink').get(),
    ]);
    // L'indice da solo non basta: il token deve combaciare con quello attuale del cliente (revoca = niente corrispondenza).
    if (client.exists && link.data()?.publicToken === token) return { id: client.id, data: client.data() as Record<string, any> };
    return null;
  }
  const legacy = await db.collection('clients').where('publicToken', '==', token).limit(1).get();
  if (legacy.empty) return null;
  return { id: legacy.docs[0].id, data: legacy.docs[0].data() as Record<string, any> };
}
