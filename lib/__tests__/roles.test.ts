import { describe, it, expect } from 'vitest';
import {
    CAPABILITIES, STAFF_ROLES, PORTAL_CAPABILITIES, can, hasCapability, isStaffUser, isAdminUser, staffRolesOf, portalLevelOf,
    type Capability, type RoleUser, type StaffRole,
} from '../roles';

/**
 * La tabella di docs/ruoli.md scritta a mano e per intero: se qualcuno cambia i ruoli nel codice senza aggiornare il documento
 * (o viceversa), questo test lo dice. Non importa ROLE_CAPABILITIES apposta.
 */
const BASE: Capability[] = ['workspace.basic', 'results.view', 'reports.ownHours', 'tasks.viewOwn', 'tasks.createOwn', 'briefs.viewLinked', 'editorial.view'];
const EXPECTED: Record<StaffRole, Capability[]> = {
    Amministratore: CAPABILITIES.filter((c) => !c.startsWith('portal.')),
    'Project Manager': [...BASE, 'tasks.viewClient', 'tasks.assign', 'tasks.approve', 'briefs.view', 'briefs.manage', 'editorial.editAll', 'editorial.generate', 'editorial.requestApproval', 'social.publish', 'ads.view', 'ads.approve', 'reports.teamHours', 'reports.clients'],
    'Social Media Manager': [...BASE, 'briefs.view', 'editorial.editAll', 'editorial.generate', 'editorial.requestApproval', 'social.publish', 'ads.view'],
    Grafico: [...BASE, 'editorial.editMedia'],
    Copywriter: [...BASE, 'editorial.editCopy', 'editorial.generate'],
    'Ads Specialist': [...BASE, 'ads.view', 'ads.manage'],
    Collaboratore: [...BASE, 'editorial.editAssigned'],
};

const staff = (role: string, over: Partial<RoleUser> = {}): RoleUser => ({ id: 'u1', role, status: 'Attivo', ...over });
const granted = (u: RoleUser) => CAPABILITIES.filter((c) => c !== 'economics.view' && hasCapability(u, c)).sort();

describe('ruoli dello staff', () => {
    for (const role of STAFF_ROLES) {
        it(`${role}: ha esattamente le capacità della tabella`, () => {
            const want = EXPECTED[role].filter((c) => c !== 'economics.view').sort();
            expect(granted(staff(role))).toEqual(want);
        });
    }
    it('i sette ruoli della tabella sono tutti coperti', () => {
        expect([...STAFF_ROLES].sort()).toEqual(Object.keys(EXPECTED).sort());
    });
});

describe('budget e costi', () => {
    it('l\'Amministratore li vede sempre', () => {
        expect(hasCapability(staff('Amministratore'), 'economics.view')).toBe(true);
    });
    it('gli altri solo con la spunta del ruolo', () => {
        expect(hasCapability(staff('Project Manager'), 'economics.view')).toBe(false);
        expect(hasCapability(staff('Project Manager'), 'economics.view', { financialsGranted: true })).toBe(true);
        expect(hasCapability(staff('Grafico'), 'economics.view', { financialsGranted: true })).toBe(true);
    });
    it('un utente cliente non li ha mai, nemmeno con la spunta', () => {
        expect(hasCapability({ id: 'c', role: 'Cliente', clientId: 'a' }, 'economics.view', { financialsGranted: true })).toBe(false);
    });
});

describe('fallisce chiuso', () => {
    it('ruolo mancante, vuoto o sconosciuto: nessuna capacità e non è staff', () => {
        for (const role of [undefined, null, '', 'admin', 'pm', 'Collaborator', 'amministratore']) {
            const u: RoleUser = { id: 'x', role };
            expect(granted(u)).toEqual([]);
            expect(isStaffUser(u)).toBe(false);
            expect(isAdminUser(u)).toBe(false);
        }
    });
    it('un utente inattivo non può niente, nemmeno l\'Amministratore', () => {
        expect(granted(staff('Amministratore', { status: 'Inattivo' }))).toEqual([]);
        expect(isStaffUser(staff('Project Manager', { status: 'Inattivo' }))).toBe(false);
    });
    it('nessun utente', () => {
        expect(hasCapability(null, 'workspace.basic')).toBe(false);
        expect(can(undefined, 'workspace.basic')).toBe(false);
    });
});

describe('mansioni aggiuntive', () => {
    it('sommano le capacità', () => {
        const u = staff('Grafico', { extraRoles: ['Social Media Manager'] });
        expect(hasCapability(u, 'editorial.editMedia')).toBe(true);
        expect(hasCapability(u, 'social.publish')).toBe(true);
        expect(hasCapability(u, 'tasks.approve')).toBe(false);
    });
    it('non possono mai dare Amministratore', () => {
        const u = staff('Collaboratore', { extraRoles: ['Amministratore'] });
        expect(hasCapability(u, 'admin.manage')).toBe(false);
        expect(isAdminUser(u)).toBe(false);
        expect(staffRolesOf(u)).toEqual(['Collaboratore']);
    });
    it('i ruoli sconosciuti e i doppioni si ignorano', () => {
        expect(staffRolesOf(staff('Grafico', { extraRoles: ['Grafico', 'Mago', 'Cliente', 'Copywriter'] }))).toEqual(['Grafico', 'Copywriter']);
    });
    it('un utente cliente non ottiene mai capacità dello staff', () => {
        const u: RoleUser = { id: 'c', role: 'Cliente', clientId: 'a', extraRoles: ['Project Manager'] };
        expect(hasCapability(u, 'tasks.approve')).toBe(false);
        expect(isStaffUser(u)).toBe(false);
    });
});

describe('accesso Cliente', () => {
    const referente: RoleUser = { id: 'c1', role: 'Cliente', clientId: 'a', portalLevel: 'referente' };
    const lettore: RoleUser = { id: 'c2', role: 'Cliente', clientId: 'a', portalLevel: 'lettore' };
    it('il referente approva e invia brief, il lettore solo vede', () => {
        expect(granted(referente)).toEqual([...PORTAL_CAPABILITIES.referente].sort());
        expect(granted(lettore)).toEqual(['portal.results']);
    });
    it('senza livello è referente: gli accessi di oggi non cambiano', () => {
        const u: RoleUser = { id: 'c', role: 'Cliente', clientId: 'a' };
        expect(portalLevelOf(u)).toBe('referente');
        expect(hasCapability(u, 'portal.approve')).toBe(true);
    });
    it('un livello sconosciuto vale lettore', () => {
        const u: RoleUser = { id: 'c', role: 'Cliente', clientId: 'a', portalLevel: 'capo' };
        expect(portalLevelOf(u)).toBe('lettore');
        expect(hasCapability(u, 'portal.approve')).toBe(false);
    });
    it('senza un cliente collegato non può niente', () => {
        expect(granted({ id: 'c', role: 'Cliente' })).toEqual([]);
    });
    it('opera solo sul proprio cliente', () => {
        expect(can(referente, 'portal.approve', { id: 'a' })).toBe(true);
        expect(can(referente, 'portal.approve', { id: 'b' })).toBe(false);
        expect(can(referente, 'portal.approve')).toBe(false);
    });
});

describe('clienti assegnati', () => {
    const client = { id: 'a', managedBy: ['pm1'], socialManagerId: 'sm1', backupManagerId: 'bk1' };
    const other = { id: 'b', managedBy: ['pm2'] };

    it('lo staff opera solo sui clienti in cui è assegnato (responsabile, social manager, backup)', () => {
        expect(can(staff('Project Manager', { id: 'pm1' }), 'tasks.approve', client)).toBe(true);
        expect(can(staff('Social Media Manager', { id: 'sm1' }), 'editorial.editAll', client)).toBe(true);
        expect(can(staff('Project Manager', { id: 'bk1' }), 'tasks.approve', client)).toBe(true);
        expect(can(staff('Project Manager', { id: 'pm1' }), 'tasks.approve', other)).toBe(false);
    });
    it('l\'Amministratore opera su tutti', () => {
        expect(can(staff('Amministratore', { id: 'boss' }), 'briefs.manage', other)).toBe(true);
    });
    it('essere assegnati non dà capacità che il ruolo non ha', () => {
        expect(can(staff('Grafico', { id: 'pm1' }), 'tasks.approve', client)).toBe(false);
        expect(can(staff('Copywriter', { id: 'sm1' }), 'social.publish', client)).toBe(false);
    });
    it('senza il cliente, le capacità legate ai clienti si negano', () => {
        expect(can(staff('Project Manager', { id: 'pm1' }), 'tasks.approve')).toBe(false);
        expect(can(staff('Project Manager', { id: 'pm1' }), 'tasks.approve', null)).toBe(false);
    });
    it('quelle non legate a un cliente funzionano senza', () => {
        expect(can(staff('Grafico'), 'workspace.basic')).toBe(true);
        expect(can(staff('Collaboratore'), 'reports.ownHours')).toBe(true);
        expect(can(staff('Project Manager'), 'admin.manage')).toBe(false);
        expect(can(staff('Amministratore'), 'admin.manage')).toBe(true);
    });
    it('budget e costi su un cliente: con la spunta, e solo se assegnato', () => {
        const pm = staff('Project Manager', { id: 'pm1' });
        expect(can(pm, 'economics.view', client)).toBe(false);
        expect(can(pm, 'economics.view', client, { financialsGranted: true })).toBe(true);
        expect(can(pm, 'economics.view', other, { financialsGranted: true })).toBe(false);
    });
});
