/**
 * Sposta mediaPlan, postLead, budget, notes e publicToken da clients/{id} a clients/{id}/private/* (solo staff, vedi firestore.rules).
 * La logica sta in lib/client-private-migrate.ts (la usa anche la pagina admin «Migrazione dati»).
 *
 * Uso (serve un .env con FIREBASE_*, che su Vercel sono «sensibili» e non si scaricano: in quel caso usa la pagina admin):
 *   npx tsx --env-file=.env.local scripts/migrate-client-private.ts            # prova: non scrive nulla
 *   npx tsx --env-file=.env.local scripts/migrate-client-private.ts --apply    # copia nella sottocollezione
 *   npx tsx --env-file=.env.local scripts/migrate-client-private.ts --apply --delete-legacy
 */
import { adminDb } from '../lib/firebase-admin';
import { migrateClientPrivate } from '../lib/client-private-migrate';

migrateClientPrivate(adminDb, { apply: process.argv.includes('--apply'), deleteLegacy: process.argv.includes('--delete-legacy') })
  .then((r) => {
    r.log.forEach((l) => console.log(l));
    console.log(`\nFatto. copiati: ${r.copied}, rimossi: ${r.deleted}, non verificati: ${r.mismatched}, da copiare (prova): ${r.skipped}`);
    if (r.mismatched) process.exitCode = 1;
  })
  .catch((e) => { console.error(e); process.exit(1); });
