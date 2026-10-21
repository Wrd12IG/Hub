import { describe, it, expect } from 'vitest';
import { migrateClientPrivate, migrateClientDoc, hasLegacyPrivateFields } from '../client-private-migrate';

// Firestore finto in memoria: solo quello che serve alla migrazione
function fakeDb(clients: Record<string, Record<string, any>>) {
    const priv: Record<string, any> = {};
    const docs = Object.entries(clients).map(([id, data]) => ({
        id,
        get: (f: string) => data[f],
        ref: {
            firestore: { collection: (n: string) => ({ doc: (t: string) => ({ set: async (v: any) => { priv[`${n}/${t}`] = v; } }) }) },
            collection: () => ({
                doc: (f: string) => ({ get: async () => ({ data: () => priv[`${id}/${f}`] }), set: async (v: any, o?: { merge: boolean }) => { priv[`${id}/${f}`] = JSON.parse(JSON.stringify(o?.merge ? { ...priv[`${id}/${f}`], ...v } : v)); } }),
            }),
            update: async (patch: Record<string, any>) => { for (const k of Object.keys(patch)) delete data[k]; },
        },
    }));
    return { db: { collection: () => ({ get: async () => ({ docs }) }) } as any, priv, clients };
}

const plan = { lines: [{ id: 'a', amount: 100 }], assumptions: { prudentFactor: 0.6 } };

describe('migrateClientPrivate', () => {
    it('prova: non scrive nulla', async () => {
        const f = fakeDb({ c1: { name: 'City Motors', mediaPlan: plan } });
        const r = await migrateClientPrivate(f.db, { apply: false, deleteLegacy: false });
        expect(r).toMatchObject({ copied: 0, deleted: 0, skipped: 1 });
        expect(f.priv).toEqual({});
        expect(f.clients.c1.mediaPlan).toBeDefined();
    });
    it('copia: duplica nell\'area riservata e lascia l\'originale', async () => {
        const f = fakeDb({ c1: { name: 'City Motors', mediaPlan: plan, postLead: { entries: [] } } });
        const r = await migrateClientPrivate(f.db, { apply: true, deleteLegacy: false });
        expect(r).toMatchObject({ copied: 2, deleted: 0, mismatched: 0 });
        expect(f.priv['c1/mediaPlan']).toEqual(plan);
        expect(f.clients.c1.mediaPlan).toBeDefined();
    });
    it('rimuovi: toglie il vecchio campo solo dopo la copia identica', async () => {
        const f = fakeDb({ c1: { name: 'X', mediaPlan: plan } });
        const r = await migrateClientPrivate(f.db, { apply: true, deleteLegacy: true });
        expect(r).toMatchObject({ copied: 1, deleted: 1 });
        expect(f.clients.c1.mediaPlan).toBeUndefined();
        expect(f.priv['c1/mediaPlan']).toEqual(plan);
    });
    it('senza dati da migrare lo dice e non fa nulla', async () => {
        const f = fakeDb({ c1: { name: 'X' } });
        const r = await migrateClientPrivate(f.db, { apply: true, deleteLegacy: true });
        expect(r.log[0]).toContain('Niente da migrare');
    });
});

describe('campi scalari (budget, note, token)', () => {
    it('copia nei gruppi, indicizza il token, rimuove solo dopo la verifica e poi è idempotente', async () => {
        const f = fakeDb({ c1: { name: 'X', budget: 1200, notes: 'solo staff', publicToken: 'tok-1234567890abcdef', publicTokenCreatedAt: '2026-01-01' } });
        const r = await migrateClientPrivate(f.db, { apply: true, deleteLegacy: true });
        expect(r).toMatchObject({ copied: 2, deleted: 2, mismatched: 0 });
        expect(f.priv['c1/internal']).toEqual({ budget: 1200, notes: 'solo staff' });
        expect(f.priv['c1/publicLink']).toEqual({ publicToken: 'tok-1234567890abcdef', publicTokenCreatedAt: '2026-01-01' });
        expect(f.priv['publicTokens/tok-1234567890abcdef']).toMatchObject({ clientId: 'c1' });
        expect(f.clients.c1).toEqual({ name: 'X' });
        const again = await migrateClientPrivate(f.db, { apply: true, deleteLegacy: true });
        expect(again).toMatchObject({ copied: 0, deleted: 0 });
    });
    it('budget 0 è un valore da migrare, non assenza', () => {
        expect(hasLegacyPrivateFields({ budget: 0 })).toBe(true);
    });
});

describe('migrazione di un cliente solo (all\'apertura)', () => {
    it('sa se ci sono campi da spostare', () => {
        expect(hasLegacyPrivateFields({ name: 'X', mediaPlan: plan })).toBe(true);
        expect(hasLegacyPrivateFields({ name: 'X' })).toBe(false);
        expect(hasLegacyPrivateFields(undefined)).toBe(false);
    });
    it('copia, verifica e toglie il vecchio campo; una seconda volta non fa nulla', async () => {
        const f = fakeDb({ c1: { name: 'X', mediaPlan: plan } });
        const doc = (await f.db.collection().get()).docs[0];
        const r1 = await migrateClientDoc(doc, { apply: true, deleteLegacy: true });
        expect(r1).toMatchObject({ copied: 1, deleted: 1, mismatched: 0 });
        expect(f.clients.c1.mediaPlan).toBeUndefined();
        const r2 = await migrateClientDoc(doc, { apply: true, deleteLegacy: true });
        expect(r2).toMatchObject({ copied: 0, deleted: 0 });
        expect(f.priv['c1/mediaPlan']).toEqual(plan);
    });
});
