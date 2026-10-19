import { describe, it, expect } from 'vitest';
import { migrateClientPrivate } from '../client-private-migrate';

// Firestore finto in memoria: solo quello che serve alla migrazione
function fakeDb(clients: Record<string, Record<string, any>>) {
    const priv: Record<string, any> = {};
    const docs = Object.entries(clients).map(([id, data]) => ({
        id,
        get: (f: string) => data[f],
        ref: {
            collection: () => ({
                doc: (f: string) => ({ get: async () => ({ data: () => priv[`${id}/${f}`] }), set: async (v: any) => { priv[`${id}/${f}`] = JSON.parse(JSON.stringify(v)); } }),
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
