// Sposta i campi interni (mediaPlan, postLead, budget, notes, publicToken) da clients/{id} a clients/{id}/private/* (solo staff, vedi firestore.rules).
// Usata sia dallo script a riga di comando sia dalla route admin: la logica è una sola.
//
// Idempotente. Senza `deleteLegacy` non cancella mai nulla; con `deleteLegacy` toglie il vecchio campo solo dopo aver
// riletto la copia e verificato che sia identica all'originale.

import { isDeepStrictEqual } from 'node:util';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { OBJECT_PRIVATE_FIELDS, SCALAR_PRIVATE_GROUPS, PRIVATE_CLIENT_FIELDS } from './client-private';
import { PUBLIC_TOKENS } from './client-public-link';

export interface MigrationResult { log: string[]; copied: number; deleted: number; skipped: number; mismatched: number }

type DocLike = { id: string; get: (f: string) => unknown; ref: { collection: (n: string) => { doc: (f: string) => { get: () => Promise<{ data: () => any }>; set: (v: any, o?: { merge: boolean }) => Promise<unknown> } }; update: (patch: Record<string, unknown>) => Promise<unknown>; firestore?: { collection: (n: string) => { doc: (id: string) => { set: (v: any) => Promise<unknown> } } } } };

/** I campi riservati ancora nel documento cliente (cioè da migrare): serve a decidere in fretta se c'è da fare qualcosa. */
export const hasLegacyPrivateFields = (data: Record<string, unknown> | undefined | null): boolean =>
    !!data && PRIVATE_CLIENT_FIELDS.some((f) => data[f] != null);

/** Un cliente solo: copia, rilegge, verifica e (se richiesto) toglie il vecchio campo. Usata dal giro completo e dall'apertura del cliente. */
export async function migrateClientDoc(c: DocLike, opts: { apply: boolean; deleteLegacy: boolean }, acc?: MigrationResult): Promise<MigrationResult> {
    const r = acc ?? { log: [], copied: 0, deleted: 0, skipped: 0, mismatched: 0 };
    for (const f of OBJECT_PRIVATE_FIELDS) {
        const legacy = c.get(f);
        if (legacy == null) continue;
        const target = c.ref.collection('private').doc(f);
        const label = `${c.id} (${c.get('name') ?? '?'}) · ${f}`;

        let existing = (await target.get()).data();
        if (!existing || !isDeepStrictEqual(existing, legacy)) {
            if (!opts.apply) { r.log.push(`[prova] copierei ${label}`); r.skipped++; continue; }
            await target.set(legacy);
            existing = (await target.get()).data(); // rilettura: la verifica è sul dato scritto davvero
            r.copied++;
            r.log.push(`copiato ${label}`);
        }

        if (!isDeepStrictEqual(existing, legacy)) {
            r.log.push(`ATTENZIONE copia diversa dall'originale, non tocco ${label}`);
            r.mismatched++;
            continue;
        }
        if (opts.deleteLegacy && opts.apply) {
            await c.ref.update({ [f]: FieldValue.delete() });
            r.deleted++;
            r.log.push(`rimosso il vecchio campo ${label}`);
        }
    }

    // Campi scalari (budget, note, token): un documento per gruppo, copiato con merge e verificato chiave per chiave.
    for (const [group, keys] of Object.entries(SCALAR_PRIVATE_GROUPS)) {
        const legacy: Record<string, unknown> = {};
        for (const k of keys) { const v = c.get(k); if (v != null) legacy[k] = v; }
        if (Object.keys(legacy).length === 0) continue;
        const target = c.ref.collection('private').doc(group);
        const label = `${c.id} (${c.get('name') ?? '?'}) · ${group} [${Object.keys(legacy).join(', ')}]`;
        const same = (d: any) => !!d && Object.keys(legacy).every((k) => isDeepStrictEqual(d[k], legacy[k]));

        let existing = (await target.get()).data();
        if (!same(existing)) {
            if (!opts.apply) { r.log.push(`[prova] copierei ${label}`); r.skipped++; continue; }
            await target.set(legacy, { merge: true });
            existing = (await target.get()).data();
            r.copied++;
            r.log.push(`copiato ${label}`);
        }
        if (!same(existing)) {
            r.log.push(`ATTENZIONE copia diversa dall'originale, non tocco ${label}`);
            r.mismatched++;
            continue;
        }
        // Indice solo-server per il link pubblico: serve alla route /share per trovare il cliente dal token.
        if (opts.apply && typeof legacy.publicToken === 'string' && c.ref.firestore) {
            await c.ref.firestore.collection(PUBLIC_TOKENS).doc(legacy.publicToken).set({ clientId: c.id, createdAt: legacy.publicTokenCreatedAt ?? null });
        }
        if (opts.deleteLegacy && opts.apply) {
            await c.ref.update(Object.fromEntries(Object.keys(legacy).map((k) => [k, FieldValue.delete()])));
            r.deleted++;
            r.log.push(`rimossi i vecchi campi ${label}`);
        }
    }
    return r;
}

export async function migrateClientPrivate(db: Firestore, opts: { apply: boolean; deleteLegacy: boolean }): Promise<MigrationResult> {
    const result: MigrationResult = { log: [], copied: 0, deleted: 0, skipped: 0, mismatched: 0 };
    const clients = await db.collection('clients').get();
    for (const c of clients.docs) await migrateClientDoc(c as unknown as DocLike, opts, result);
    if (result.log.length === 0) result.log.push('Niente da migrare: nessun cliente ha dati interni (piano media, post-lead, budget, note, token) nel documento.');
    return result;
}
