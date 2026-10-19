// Sposta mediaPlan e postLead da clients/{id} a clients/{id}/private/{campo} (solo staff, vedi firestore.rules).
// Usata sia dallo script a riga di comando sia dalla route admin: la logica è una sola.
//
// Idempotente. Senza `deleteLegacy` non cancella mai nulla; con `deleteLegacy` toglie il vecchio campo solo dopo aver
// riletto la copia e verificato che sia identica all'originale.

import { isDeepStrictEqual } from 'node:util';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { PRIVATE_CLIENT_FIELDS } from './client-private';

export interface MigrationResult { log: string[]; copied: number; deleted: number; skipped: number; mismatched: number }

export async function migrateClientPrivate(db: Firestore, opts: { apply: boolean; deleteLegacy: boolean }): Promise<MigrationResult> {
    const { apply, deleteLegacy } = opts;
    const log: string[] = [];
    let copied = 0, deleted = 0, skipped = 0, mismatched = 0;

    const clients = await db.collection('clients').get();
    for (const c of clients.docs) {
        for (const f of PRIVATE_CLIENT_FIELDS) {
            const legacy = c.get(f);
            if (legacy == null) continue;
            const target = c.ref.collection('private').doc(f);
            const label = `${c.id} (${c.get('name') ?? '?'}) · ${f}`;

            let existing = (await target.get()).data();
            if (!existing || !isDeepStrictEqual(existing, legacy)) {
                if (!apply) { log.push(`[prova] copierei ${label}`); skipped++; continue; }
                await target.set(legacy);
                existing = (await target.get()).data(); // rilettura: la verifica è sul dato scritto davvero
                copied++;
                log.push(`copiato ${label}`);
            }

            if (!isDeepStrictEqual(existing, legacy)) {
                log.push(`ATTENZIONE copia diversa dall'originale, non tocco ${label}`);
                mismatched++;
                continue;
            }
            if (deleteLegacy && apply) {
                await c.ref.update({ [f]: FieldValue.delete() });
                deleted++;
                log.push(`rimosso il vecchio campo ${label}`);
            }
        }
    }
    if (log.length === 0) log.push('Niente da migrare: nessun cliente ha piano media o dati post-lead nel documento.');
    return { log, copied, deleted, skipped, mismatched };
}
