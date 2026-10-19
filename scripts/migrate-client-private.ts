/**
 * Sposta mediaPlan e postLead da clients/{id} a clients/{id}/private/{campo} (solo staff, vedi firestore.rules).
 *
 * Uso (a mano, con le variabili FIREBASE_* di .env.local):
 *   npx tsx --env-file=.env.local scripts/migrate-client-private.ts            # prova: non scrive nulla
 *   npx tsx --env-file=.env.local scripts/migrate-client-private.ts --apply    # copia nella sottocollezione
 *   npx tsx --env-file=.env.local scripts/migrate-client-private.ts --apply --delete-legacy
 *       # toglie il vecchio campo, ma solo dopo aver riletto la copia e verificato che sia identica
 *
 * Idempotente: si può rilanciare. Senza --delete-legacy non cancella mai nulla.
 */
import { isDeepStrictEqual } from 'node:util';
import { adminDb } from '../lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { PRIVATE_CLIENT_FIELDS } from '../lib/client-private';

const apply = process.argv.includes('--apply');
const deleteLegacy = process.argv.includes('--delete-legacy');

async function main() {
  const clients = await adminDb.collection('clients').get();
  let copied = 0, deleted = 0, skipped = 0, mismatched = 0;

  for (const c of clients.docs) {
    for (const f of PRIVATE_CLIENT_FIELDS) {
      const legacy = c.get(f);
      if (legacy == null) continue;
      const target = c.ref.collection('private').doc(f);
      const label = `${c.id} (${c.get('name') ?? '?'}) · ${f}`;

      let existing = (await target.get()).data();
      if (!existing || !isDeepStrictEqual(existing, legacy)) {
        if (!apply) { console.log(`[prova] copierei ${label}`); skipped++; continue; }
        await target.set(legacy);
        existing = (await target.get()).data(); // rilettura: la verifica è sul dato scritto davvero
        copied++;
        console.log(`copiato ${label}`);
      }

      if (!isDeepStrictEqual(existing, legacy)) {
        console.error(`ATTENZIONE copia diversa dall'originale, non tocco ${label}`);
        mismatched++;
        continue;
      }
      if (deleteLegacy && apply) {
        await c.ref.update({ [f]: FieldValue.delete() });
        deleted++;
        console.log(`rimosso il vecchio campo ${label}`);
      }
    }
  }
  console.log(`\nFatto. copiati: ${copied}, rimossi: ${deleted}, non verificati: ${mismatched}${apply ? '' : `, da copiare (prova): ${skipped}`}`);
  if (mismatched) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
