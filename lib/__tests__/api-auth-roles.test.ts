import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const store = vi.hoisted(() => ({ users: {} as Record<string, any>, clients: {} as Record<string, any>, rolePermissions: {} as Record<string, any> }));

vi.mock('@/lib/firebase-admin', () => ({
    adminAuth: {},
    adminDb: {
        collection: (name: 'users' | 'clients' | 'rolePermissions') => ({
            doc: (id: string) => ({ get: async () => ({ exists: id in store[name], id, data: () => store[name][id] }) }),
        }),
    },
}));

import { isStaffUser, ownsClientResource, denyUnlessCan, denyUnlessStaff } from '../api-auth';

beforeEach(() => {
    store.users = {};
    store.clients = { a: { managedBy: ['pm1'], socialManagerId: 'sm1' }, b: { managedBy: ['zz'] } };
    store.rolePermissions = {};
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.ROLES_ENFORCEMENT;
});

describe('isStaffUser (rigoroso)', () => {
    it('chi ha un ruolo dello staff che esiste e non è inattivo', () => {
        for (const role of ['Amministratore', 'Project Manager', 'Collaboratore', 'Grafico', 'Social Media Manager']) {
            expect(isStaffUser({ id: 'x', role })).toBe(true);
        }
    });
    it('un ruolo mancante, sconosciuto o un utente inattivo non è staff (prima bastava non essere «Cliente»)', () => {
        expect(isStaffUser({ id: 'x' })).toBe(false);
        expect(isStaffUser({ id: 'x', role: 'admin' })).toBe(false);
        expect(isStaffUser({ id: 'x', role: 'Project Manager ' })).toBe(false);
        expect(isStaffUser({ id: 'x', role: 'Project Manager', status: 'Inattivo' })).toBe(false);
        expect(isStaffUser({ id: 'x', role: 'Cliente', clientId: 'a' })).toBe(false);
        expect(isStaffUser(null)).toBe(false);
    });
});

describe('ownsClientResource', () => {
    it('solo l\'utente Cliente attivo, sul proprio cliente', () => {
        expect(ownsClientResource({ id: 'c', role: 'Cliente', clientId: 'a' }, 'a')).toBe(true);
        expect(ownsClientResource({ id: 'c', role: 'Cliente', clientId: 'a' }, 'b')).toBe(false);
        expect(ownsClientResource({ id: 'c', role: 'Cliente', clientId: 'a', status: 'Inattivo' }, 'a')).toBe(false);
        expect(ownsClientResource({ id: 'p', role: 'Project Manager', clientId: 'a' }, 'a')).toBe(false);
    });
});

describe('denyUnlessStaff', () => {
    it('nega a un utente senza ruolo, consente a uno staff', async () => {
        store.users.nessuno = { name: 'x' };
        store.users.pm1 = { role: 'Project Manager' };
        expect((await denyUnlessStaff('nessuno'))?.status).toBe(403);
        expect(await denyUnlessStaff('pm1')).toBeNull();
    });
});

describe('denyUnlessCan', () => {
    it('in osservazione (predefinita) non blocca mai, ma lo scrive nel log', async () => {
        store.users.g1 = { role: 'Grafico' };
        expect(await denyUnlessCan('g1', 'social.publish', 'a')).toBeNull();
        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(String((console.warn as any).mock.calls[0][0])).toContain('solo osservazione');
    });
    it('con ROLES_ENFORCEMENT=enforce nega davvero (403)', async () => {
        process.env.ROLES_ENFORCEMENT = 'enforce';
        store.users.g1 = { role: 'Grafico' };
        const res = await denyUnlessCan('g1', 'social.publish', 'a');
        expect(res?.status).toBe(403);
    });
    it('un PM assegnato al cliente passa, senza log', async () => {
        process.env.ROLES_ENFORCEMENT = 'enforce';
        store.users.pm1 = { role: 'Project Manager' };
        expect(await denyUnlessCan('pm1', 'social.publish', 'a')).toBeNull();
        expect(console.warn).not.toHaveBeenCalled();
    });
    it('un PM non assegnato a quel cliente: negato in enforce, solo log in osservazione', async () => {
        store.users.pm1 = { role: 'Project Manager' };
        expect(await denyUnlessCan('pm1', 'social.publish', 'b')).toBeNull();
        expect(String((console.warn as any).mock.calls[0][0])).toContain('non è assegnato');
        process.env.ROLES_ENFORCEMENT = 'enforce';
        expect((await denyUnlessCan('pm1', 'social.publish', 'b'))?.status).toBe(403);
    });
    it('l\'Amministratore passa su qualunque cliente', async () => {
        process.env.ROLES_ENFORCEMENT = 'enforce';
        store.users.boss = { role: 'Amministratore' };
        expect(await denyUnlessCan('boss', 'social.publish', 'b')).toBeNull();
    });
    it('un cliente che non esiste: negato (in enforce)', async () => {
        process.env.ROLES_ENFORCEMENT = 'enforce';
        store.users.pm1 = { role: 'Project Manager' };
        expect((await denyUnlessCan('pm1', 'social.publish', 'inesistente'))?.status).toBe(403);
    });
    it('budget e costi: serve la spunta del ruolo in rolePermissions', async () => {
        process.env.ROLES_ENFORCEMENT = 'enforce';
        store.users.pm1 = { role: 'Project Manager' };
        expect((await denyUnlessCan('pm1', 'economics.view', 'a'))?.status).toBe(403);
        store.rolePermissions['Project Manager'] = { permissions: ['_view-financials'] };
        expect(await denyUnlessCan('pm1', 'economics.view', 'a')).toBeNull();
    });
    it('un utente senza ruolo o sconosciuto: negato (in enforce)', async () => {
        process.env.ROLES_ENFORCEMENT = 'enforce';
        store.users.u = { name: 'x' };
        expect((await denyUnlessCan('u', 'workspace.basic'))?.status).toBe(403);
        expect((await denyUnlessCan('non-esiste', 'workspace.basic'))?.status).toBe(403);
    });
});
