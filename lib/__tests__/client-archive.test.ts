import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({ FieldValue: { delete: () => ({ __delete: true }) } }));

import { archivedClientIds, setClientArchived } from '../client-archive';
import { pickableClients } from '../client-archive-shared';
import { findClientByPublicToken } from '../client-public-link';

function fakeDb(seed: Record<string, Record<string, any>>) {
    const store = new Map(Object.entries(seed).map(([k, v]) => [k, { ...v }]));
    const ref = (path: string): any => ({
        path,
        get: async () => snap(path),
        update: async (patch: Record<string, any>) => {
            const cur = store.get(path)!;
            for (const [k, v] of Object.entries(patch)) { if (v && v.__delete) delete cur[k]; else cur[k] = v; }
        },
    });
    const snap = (path: string) => ({ id: path.split('/').pop()!, exists: store.has(path), ref: ref(path), data: () => store.get(path), get: (f: string) => store.get(path)?.[f] });
    const col = (name: string) => ({
        doc: (id: string) => ({ ...ref(`${name}/${id}`), collection: (sub: string) => col(`${name}/${id}/${sub}`) }),
        where: (f: string, _op: string, v: any) => ({
            select: () => ({ get: async () => ({ docs: Array.from(store.keys()).filter((k) => k.startsWith(`${name}/`) && store.get(k)![f] === v).map(snap) }) }),
            get: async () => ({ docs: Array.from(store.keys()).filter((k) => k.startsWith(`${name}/`) && store.get(k)![f] === v).map(snap), empty: false }),
            limit: () => ({ get: async () => { const d = Array.from(store.keys()).filter((k) => k.startsWith(`${name}/`) && store.get(k)![f] === v).map(snap); return { docs: d, empty: d.length === 0 }; } }),
        }),
    });
    const calls: string[] = [];
    const auth = {
        updateUser: async (uid: string, p: { disabled: boolean }) => { calls.push(`${p.disabled ? 'disable' : 'enable'}:${uid}`); },
        revokeRefreshTokens: async (uid: string) => { calls.push(`revoke:${uid}`); },
    };
    return { store, auth, calls, db: { collection: col } as any };
}

const seed = () => ({
    'clients/c1': { name: 'Dalma', monthlyKpiMail: true },
    'clients/c2': { name: 'Altro', archived: true },
    'clients/c3': { name: 'Terzo' },
    'users/u1': { name: 'Cliente Dalma', role: 'Cliente', clientId: 'c1', status: 'Attivo' },
    'users/u2': { name: 'Già bloccato', role: 'Cliente', clientId: 'c1', status: 'Inattivo' },
    'users/u3': { name: 'Staff', role: 'Collaboratore', status: 'Attivo' },
});

describe('archivedClientIds', () => {
    it('elenca solo gli archiviati', async () => {
        expect(Array.from(await archivedClientIds(fakeDb(seed()).db))).toEqual(['c2']);
    });
});

describe('setClientArchived', () => {
    it('archivia: segna il cliente, spegne la mail dei KPI ricordandolo, blocca solo gli accessi attivi del cliente', async () => {
        const f = fakeDb(seed());
        const r = await setClientArchived(f.db, f.auth, 'c1', true);
        const c = f.store.get('clients/c1')!;
        expect(c.archived).toBe(true);
        expect(typeof c.archivedAt).toBe('string');
        expect(c.monthlyKpiMail).toBe(false);
        expect(c.archivedMonthlyKpiMail).toBe(true);
        expect(r).toEqual({ blockedUsers: 1, restoredUsers: 0 });
        expect(f.calls).toEqual(['disable:u1', 'revoke:u1']);
        expect(f.store.get('users/u1')).toMatchObject({ status: 'Inattivo', archivedWithClient: true });
        expect(f.store.get('users/u2')).toMatchObject({ status: 'Inattivo' });
        expect(f.store.get('users/u2')!.archivedWithClient).toBeUndefined();
        expect(f.store.get('users/u3')!.status).toBe('Attivo');
    });
    it('riattiva: rimette tutto com\'era e riapre solo gli accessi che aveva chiuso lui', async () => {
        const f = fakeDb(seed());
        await setClientArchived(f.db, f.auth, 'c1', true);
        f.calls.length = 0;
        const r = await setClientArchived(f.db, f.auth, 'c1', false);
        const c = f.store.get('clients/c1')!;
        expect(c.archived).toBeUndefined();
        expect(c.archivedAt).toBeUndefined();
        expect(c.monthlyKpiMail).toBe(true);
        expect(c.archivedMonthlyKpiMail).toBeUndefined();
        expect(r).toEqual({ blockedUsers: 0, restoredUsers: 1 });
        expect(f.calls).toEqual(['enable:u1']);
        expect(f.store.get('users/u1')).toMatchObject({ status: 'Attivo' });
        expect(f.store.get('users/u2')!.status).toBe('Inattivo'); // bloccato da altri: resta com'è
    });
    it('un cliente senza mail dei KPI non se ne ritrova una dopo la riattivazione', async () => {
        const f = fakeDb(seed());
        await setClientArchived(f.db, f.auth, 'c3', true);
        await setClientArchived(f.db, f.auth, 'c3', false);
        expect(f.store.get('clients/c3')!.monthlyKpiMail).toBeUndefined();
    });
    it('cliente inesistente: errore', async () => {
        await expect(setClientArchived(fakeDb(seed()).db, fakeDb(seed()).auth, 'nope', true)).rejects.toThrow('not-found');
    });
});

describe('pickableClients', () => {
    const list = [{ id: 'a' }, { id: 'b', archived: true }, { id: 'c', archived: false }];
    it('toglie gli archiviati', () => expect(pickableClients(list).map((c) => c.id)).toEqual(['a', 'c']));
    it("tiene quello già scelto anche se archiviato (si sta modificando)", () => expect(pickableClients(list, 'b').map((c) => c.id)).toEqual(['a', 'b', 'c']));
});

describe('findClientByPublicToken', () => {
    const dbFor = (archived: boolean) => {
        const docs: Record<string, any> = {
            'publicTokens/tok': { clientId: 'c1' },
            'clients/c1': { name: 'X', ...(archived ? { archived: true } : {}) },
            'clients/c1/private/publicLink': { publicToken: 'tok' },
        };
        const snap = (p: string) => ({ exists: p in docs, id: p.split('/').pop(), data: () => docs[p] });
        const doc = (p: string): any => ({ get: async () => snap(p), collection: (s: string) => ({ doc: (i: string) => doc(`${p}/${s}/${i}`) }) });
        return { collection: (n: string) => ({ doc: (i: string) => doc(`${n}/${i}`) }) } as any;
    };
    it('risponde per un cliente attivo', async () => expect((await findClientByPublicToken(dbFor(false), 'tok'))?.id).toBe('c1'));
    it('non risponde per un cliente archiviato', async () => expect(await findClientByPublicToken(dbFor(true), 'tok')).toBeNull());
});
