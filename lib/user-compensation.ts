/**
 * lib/user-compensation.ts
 *
 * Stipendio mensile e costo orario delle persone. Stavano nel documento `users/{uid}`, che può leggere QUALUNQUE utente
 * collegato (anche un Cliente): servono i nomi e gli avatar in tutta l'app. Ora stanno in `users/{uid}/private/compensation`,
 * dove le regole del database lasciano leggere solo a chi ha il permesso finanziario e scrivere solo agli amministratori.
 * Stesso schema dei dati riservati dei clienti (lib/client-private.ts).
 *
 * I vecchi valori nel documento utente si spostano da soli: la prima lettura di un utente autorizzato li copia nell'area
 * riservata e li toglie dal documento.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';

export const COMPENSATION_FIELDS = ['salary', 'hourlyRate'] as const;
export type CompensationField = (typeof COMPENSATION_FIELDS)[number];
export type Compensation = Partial<Record<CompensationField, number>>;

const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/** Separa dal profilo i campi di compenso. `fields` ha solo numeri validi (o null = da togliere). */
export function splitCompensation(data: Record<string, unknown>): { rest: Record<string, unknown>; fields: Partial<Record<CompensationField, number | null>> } {
  const rest = { ...data };
  const fields: Partial<Record<CompensationField, number | null>> = {};
  for (const f of COMPENSATION_FIELDS) {
    if (!(f in rest)) continue;
    const n = num(rest[f]);
    fields[f] = n === undefined ? null : n;
    delete rest[f];
  }
  return { rest, fields };
}

const privRef = (db: Firestore, uid: string) => db.collection('users').doc(uid).collection('private').doc('compensation');

/** Scrive i compensi nell'area riservata e toglie dal documento utente l'eventuale copia rimasta. */
export async function saveCompensation(db: Firestore, uid: string, fields: Partial<Record<CompensationField, number | null>>): Promise<void> {
  const keys = Object.keys(fields) as CompensationField[];
  if (keys.length === 0) return;
  const patch: Record<string, unknown> = {};
  const legacy: Record<string, unknown> = {};
  for (const k of keys) {
    patch[k] = fields[k] === null ? FieldValue.delete() : fields[k];
    legacy[k] = FieldValue.delete();
  }
  const batch = db.batch();
  batch.set(privRef(db, uid), patch as FirebaseFirestore.DocumentData, { merge: true });
  batch.update(db.collection('users').doc(uid), legacy as FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>);
  await batch.commit();
}

/**
 * Compensi di tutti: area riservata, con ripiego sul vecchio campo nel documento. I vecchi campi trovati si spostano
 * (copia, poi tolti dal documento): dopo la prima lettura di un utente autorizzato non restano più leggibili da tutti.
 */
export async function readAllCompensation(db: Firestore): Promise<Record<string, Compensation>> {
  const [users, priv] = await Promise.all([db.collection('users').get(), db.collectionGroup('private').get()]);
  const out: Record<string, Compensation> = {};
  for (const d of priv.docs) {
    if (d.id !== 'compensation' || d.ref.parent.parent?.parent.id !== 'users') continue;
    const data = d.data() as Compensation;
    out[d.ref.parent.parent.id] = { salary: num(data.salary), hourlyRate: num(data.hourlyRate) };
  }
  for (const u of users.docs) {
    const move: Partial<Record<CompensationField, number | null>> = {};
    for (const f of COMPENSATION_FIELDS) {
      if (u.get(f) === undefined) continue;
      const stored = out[u.id]?.[f];
      const n = stored !== undefined ? stored : num(u.get(f));
      if (n !== undefined) (out[u.id] ??= {})[f] = n;
      move[f] = n === undefined ? null : n; // copia nell'area riservata (o niente) e toglie dal documento
    }
    if (Object.keys(move).length > 0) await saveCompensation(db, u.id, move);
  }
  return out;
}
