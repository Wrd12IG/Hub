import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({
    FieldValue: { arrayRemove: (v: string) => ({ __arrayRemove: v }), delete: () => ({ __delete: true }) },
}));

import { clientImpact, deleteClientCascade } from '../client-delete';

// Firestore finto in memoria: percorsi piatti «raccolta/id[/sotto/id]», solo ciò che serve alla cancellazione.
function fakeDb(seed: Record<string, Record<string, any>>) {
    const store = new Map<string, Record<string, any>>(Object.entries(seed).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
    const recursive: string[] = [];
    const snap = (path: string) => ({
        id: path.split('/').pop()!,
        exists: store.has(path),
        data: () => store.get(path),
        get: (f: string) => store.get(path)?.[f],
        ref: ref(path),
    });
    const ref = (path: string): any => ({
        path,
        get: async () => snap(path),
        delete: async () => { store.delete(path); },
        update: async (patch: Record<string, any>) => {
            const cur = store.get(path)!;
            for (const [k, v] of Object.entries(patch)) {
                if (v && v.__delete) delete cur[k];
                else if (v && v.__arrayRemove !== undefined) cur[k] = (cur[k] || []).filter((x: string) => x !== v.__arrayRemove);
                else cur[k] = v;
            }
        },
        collection: (sub: string) => collection(`${path}/${sub}`),
    });
    const collection = (name: string): any => {
        const docsOf = () => Array.from(store.keys()).filter((k) => k.startsWith(`${name}/`) && k.split('/').length === name.split('/').length + 1);
        const query = (filter: (d: Record<string, any>) => boolean) => ({
            get: async () => { const docs = docsOf().filter((k) => filter(store.get(k)!)).map(snap); return { docs, size: docs.length, empty: docs.length === 0 }; },
            limit: () => query(filter),
        });
        return {
            doc: (id: string) => ref(`${name}/${id}`),
            get: async () => query(() => true).get(),
            limit: () => query(() => true),
            where: (field: string, op: string, value: any) => query((d) => (op === '==' ? d[field] === value : (d[field] || []).includes(value))),
        };
    };
    const db: any = {
        collection,
        batch: () => { const ops: (() => Promise<void>)[] = []; return { delete: (r: any) => ops.push(() => r.delete()), commit: async () => { for (const o of ops) await o(); } }; },
        recursiveDelete: async (r: any) => { recursive.push(r.path); for (const k of Array.from(store.keys())) if (k === r.path || k.startsWith(`${r.path}/`)) store.delete(k); },
    };
    return { db, store, recursive };
}

const seed = {
    'clients/c1': { name: 'Dalma', publicToken: 'tok-old' },
    'clients/c1/private/publicLink': { publicToken: 'tok-new' },
    'clients/c1/integrations/meta': { accessToken: 'x' },
    'clients/c2': { name: 'Altro' },
    'publicTokens/tok-new': { clientId: 'c1' },
    'publicTokens/tok-old': { clientId: 'c1' },
    'publicTokens/tok-other': { clientId: 'c2' },
    'tasks/t1': { clientId: 'c1' }, 'tasks/t2': { clientId: 'c1' }, 'tasks/t3': { clientId: 'c2' },
    'projects/p1': { clientId: 'c1' },
    'editorialContents/e1': { clientId: 'c1' }, 'editorialContents/e2': { clientId: 'c2' },
    'briefs/b1': { clientId: 'c1' },
    'calendarActivities/a1': { clientId: 'c1' },
    'calendarActivities/a2': { clientIds: ['c1', 'c2'] },
    'calendarActivities/a3': { clientId: 'c1', clientIds: ['c1'] },
    'users/u1': { name: 'Cliente Dalma', email: 'x@dalma.it', role: 'Cliente', clientId: 'c1' },
    'users/u2': { name: 'Staff', role: 'Collaboratore' },
};

describe('clientImpact', () => {
    it('conta solo ciò che è di questo cliente, e dice quali accessi e collegamenti esistono', async () => {
        const f = fakeDb(seed);
        const r = await clientImpact(f.db, 'c1');
        expect(Object.fromEntries(r.counts.map((c) => [c.label, c.count]))).toEqual({
            task: 2, progetti: 1, 'contenuti del piano editoriale': 1, brief: 1, 'attività di calendario': 2,
        });
        expect(r.sharedActivities).toBe(1);
        expect(r.clientUsers).toEqual([{ id: 'u1', name: 'Cliente Dalma', email: 'x@dalma.it' }]);
        expect(r.hasPublicLink).toBe(true);
        expect(r.hasIntegrations).toBe(true);
    });
    it('non tocca niente', async () => {
        const f = fakeDb(seed);
        const before = Array.from(f.store.keys()).sort();
        await clientImpact(f.db, 'c1');
        expect(Array.from(f.store.keys()).sort()).toEqual(before);
    });
});

describe('deleteClientCascade', () => {
    it('toglie il cliente con sotto-raccolte, link pubblico e lavoro collegato; lascia stare gli altri clienti', async () => {
        const f = fakeDb(seed);
        const r = await deleteClientCascade(f.db, 'c1');
        const left = Array.from(f.store.keys()).sort();
        expect(left).toEqual([
            'calendarActivities/a2', 'clients/c2', 'editorialContents/e2', 'publicTokens/tok-other', 'tasks/t3', 'users/u1', 'users/u2',
        ]);
        expect(f.recursive).toEqual(['clients/c1']);
        expect(r.clientUserIds).toEqual(['u1']);
        expect(r.removed).toMatchObject({ tasks: 2, projects: 1, editorialContents: 1, briefs: 1, calendarActivities: 2 });
    });
    it("l'attività condivisa resta e perde solo questo cliente", async () => {
        const f = fakeDb(seed);
        await deleteClientCascade(f.db, 'c1');
        expect(f.store.get('calendarActivities/a2')).toEqual({ clientIds: ['c2'] });
    });
});
