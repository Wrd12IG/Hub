import { describe, it, expect } from 'vitest';
import { canSeeFinancials, canViewFinancialsServer, withoutFinancials } from '../financial-access';

const dbWith = (perms: Record<string, string[] | undefined>) => ({
    collection: () => ({ doc: (role: string) => ({ get: async () => ({ exists: role in perms, data: () => ({ permissions: perms[role] }) }) }) }),
}) as any;

describe('canSeeFinancials', () => {
    it("l'amministratore li vede sempre, anche senza permessi salvati", () => {
        expect(canSeeFinancials('Amministratore', undefined)).toBe(true);
        expect(canSeeFinancials('Amministratore', [])).toBe(true);
    });
    it('PM e Collaboratore solo con la spunta', () => {
        expect(canSeeFinancials('Project Manager', ['/clients'])).toBe(false);
        expect(canSeeFinancials('Project Manager', ['/clients', '_view-financials'])).toBe(true);
        expect(canSeeFinancials('Collaboratore', undefined)).toBe(false);
    });
    it('il Cliente mai, nemmeno con la chiave', () => {
        expect(canSeeFinancials('Cliente', ['_view-financials'])).toBe(false);
    });
    it('senza ruolo no', () => {
        expect(canSeeFinancials(undefined, ['_view-financials'])).toBe(false);
    });
});

describe('canViewFinancialsServer', () => {
    it('legge i permessi del ruolo dal database', async () => {
        const db = dbWith({ 'Project Manager': ['_view-financials'], Collaboratore: ['/tasks'] });
        expect(await canViewFinancialsServer(db, { role: 'Project Manager' })).toBe(true);
        expect(await canViewFinancialsServer(db, { role: 'Collaboratore' })).toBe(false);
    });
    it('ruolo senza documento di permessi: no', async () => {
        expect(await canViewFinancialsServer(dbWith({}), { role: 'Project Manager' })).toBe(false);
    });
    it("l'amministratore passa senza leggere nulla; utente assente o Cliente no", async () => {
        const boom = { collection: () => { throw new Error('non doveva leggere'); } } as any;
        expect(await canViewFinancialsServer(boom, { role: 'Amministratore' })).toBe(true);
        expect(await canViewFinancialsServer(boom, null)).toBe(false);
        expect(await canViewFinancialsServer(boom, { role: 'Cliente' })).toBe(false);
    });
});

describe('withoutFinancials', () => {
    it('toglie budget e note e lascia il resto, senza toccare l\'originale', () => {
        const c = { name: 'X', budget: 100, notes: 'riservato', phone: '1' };
        expect(withoutFinancials(c)).toEqual({ name: 'X', phone: '1' });
        expect(c.budget).toBe(100);
    });
});
