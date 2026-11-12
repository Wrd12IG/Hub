import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase-admin/firestore', () => ({ FieldValue: { delete: () => ({ __delete: true }) } }));

import { splitCompensation, saveCompensation, readAllCompensation } from '../user-compensation';

// Firestore finto: percorsi piatti, solo ciò che serve (get di raccolta e di gruppo, batch set/update).
function fakeDb(seed: Record<string, Record<string, any>>) {
    const store = new Map(Object.entries(seed).map(([k, v]) => [k, { ...v }]));
    const apply = (cur: Record<string, any>, patch: Record<string, any>) => {
        for (const [k, v] of Object.entries(patch)) { if (v && v.__delete) delete cur[k]; else cur[k] = v; }
    };
    const docRef = (path: string): any => ({
        path, id: path.split('/').pop(),
        parent: { id: path.split('/').slice(-2)[0], parent: path.split('/').length > 2 ? docRef(path.split('/').slice(0, -2).join('/')) : null },
        collection: (sub: string) => ({ doc: (id: string) => docRef(`${path}/${sub}/${id}`) }),
    });
    const snap = (path: string) => ({ id: path.split('/').pop()!, ref: docRef(path), data: () => store.get(path), get: (f: string) => store.get(path)?.[f] });
    return {
        store,
        db: {
            collection: (name: string) => ({
                doc: (id: string) => docRef(`${name}/${id}`),
                get: async () => ({ docs: Array.from(store.keys()).filter((k) => k.split('/').length === 2 && k.startsWith(`${name}/`)).map(snap) }),
            }),
            collectionGroup: (name: string) => ({ get: async () => ({ docs: Array.from(store.keys()).filter((k) => k.split('/').length > 2 && k.split('/').slice(-2)[0] === name).map(snap) }) }),
            batch: () => {
                const ops: (() => void)[] = [];
                return {
                    set: (r: any, v: any, o?: any) => ops.push(() => { const cur = store.get(r.path) ?? {}; apply(cur, v); store.set(r.path, cur); void o; }),
                    update: (r: any, v: any) => ops.push(() => { const cur = store.get(r.path)!; apply(cur, v); }),
                    commit: async () => { ops.forEach((o) => o()); },
                };
            },
        } as any,
    };
}

describe('splitCompensation', () => {
    it('separa stipendio e costo orario dal resto e converte i numeri', () => {
        const r = splitCompensation({ name: 'Anna', salary: '1500,5', hourlyRate: '28,5' });
        expect(r.rest).toEqual({ name: 'Anna' });
        expect(r.fields).toEqual({ salary: 1500.5, hourlyRate: 28.5 });
    });
    it('valori vuoti o negativi diventano «da togliere»', () => {
        expect(splitCompensation({ salary: '', hourlyRate: -3 }).fields).toEqual({ salary: null, hourlyRate: null });
    });
    it('senza i campi non produce nulla', () => {
        expect(splitCompensation({ name: 'X' }).fields).toEqual({});
    });
});

describe('saveCompensation', () => {
    it("scrive nell'area riservata e toglie la copia dal profilo", async () => {
        const f = fakeDb({ 'users/u1': { name: 'Anna', hourlyRate: 30, salary: 2000 } });
        await saveCompensation(f.db, 'u1', { hourlyRate: 35 });
        expect(f.store.get('users/u1/private/compensation')).toEqual({ hourlyRate: 35 });
        expect(f.store.get('users/u1')).toEqual({ name: 'Anna', salary: 2000 });
    });
    it('null toglie il valore', async () => {
        const f = fakeDb({ 'users/u1': { name: 'Anna' }, 'users/u1/private/compensation': { hourlyRate: 30, salary: 2000 } });
        await saveCompensation(f.db, 'u1', { salary: null });
        expect(f.store.get('users/u1/private/compensation')).toEqual({ hourlyRate: 30 });
    });
    it('senza campi non scrive niente', async () => {
        const f = fakeDb({ 'users/u1': { name: 'Anna', hourlyRate: 30 } });
        await saveCompensation(f.db, 'u1', {});
        expect(f.store.has('users/u1/private/compensation')).toBe(false);
    });
});

describe('readAllCompensation', () => {
    it("legge l'area riservata", async () => {
        const f = fakeDb({ 'users/u1': { name: 'A' }, 'users/u1/private/compensation': { hourlyRate: 40, salary: 2500 } });
        expect(await readAllCompensation(f.db)).toEqual({ u1: { hourlyRate: 40, salary: 2500 } });
    });
    it('sposta i vecchi campi del profilo: copiati nell\'area riservata e tolti dal profilo', async () => {
        const f = fakeDb({ 'users/u2': { name: 'B', hourlyRate: 22, salary: 1800 } });
        const r = await readAllCompensation(f.db);
        expect(r.u2).toEqual({ hourlyRate: 22, salary: 1800 });
        expect(f.store.get('users/u2/private/compensation')).toEqual({ hourlyRate: 22, salary: 1800 });
        expect(f.store.get('users/u2')).toEqual({ name: 'B' });
    });
    it("se l'area riservata ha già un valore, il vecchio campo non lo sovrascrive ma viene tolto", async () => {
        const f = fakeDb({ 'users/u3': { name: 'C', hourlyRate: 10 }, 'users/u3/private/compensation': { hourlyRate: 45 } });
        const r = await readAllCompensation(f.db);
        expect(r.u3.hourlyRate).toBe(45);
        expect(f.store.get('users/u3')).toEqual({ name: 'C' });
        expect(f.store.get('users/u3/private/compensation')).toEqual({ hourlyRate: 45 });
    });
    it('ignora i documenti «private» dei clienti', async () => {
        const f = fakeDb({ 'users/u1': { name: 'A' }, 'clients/c1/private/compensation': { hourlyRate: 99 } });
        expect(await readAllCompensation(f.db)).toEqual({});
    });
});
