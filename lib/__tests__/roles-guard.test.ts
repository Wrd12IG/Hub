import { describe, it, expect } from 'vitest';
import { decideAccess, enforcementMode, shouldBlock, describeDenial } from '../roles-guard';
import type { RoleUser } from '../roles';

const staff = (role: string, over: Partial<RoleUser> = {}): RoleUser => ({ id: 'u1', role, status: 'Attivo', ...over });
const client = { id: 'a', managedBy: ['u1'], socialManagerId: 'sm', backupManagerId: 'bk' };
const other = { id: 'b', managedBy: ['zz'] };

describe('enforcementMode', () => {
    it('predefinita: solo osservazione', () => {
        for (const v of [undefined, null, '', 'observe', 'boh', 'off', '0']) expect(enforcementMode(v)).toBe('observe');
    });
    it('enforce, 1 e true bloccano davvero', () => {
        for (const v of ['enforce', 'ENFORCE', ' 1 ', 'true']) expect(enforcementMode(v)).toBe('enforce');
    });
});

describe('decideAccess', () => {
    it('consente se il ruolo ha la capacità e il cliente è assegnato', () => {
        expect(decideAccess({ user: staff('Project Manager'), capability: 'social.publish', client }).allowed).toBe(true);
    });
    it('nega con il motivo giusto', () => {
        expect(decideAccess({ user: null, capability: 'social.publish', client })).toEqual({ allowed: false, reason: 'no-user' });
        expect(decideAccess({ user: staff('Grafico'), capability: 'social.publish', client })).toEqual({ allowed: false, reason: 'no-capability' });
        expect(decideAccess({ user: staff('Project Manager'), capability: 'social.publish' })).toEqual({ allowed: false, reason: 'no-client' });
        expect(decideAccess({ user: staff('Project Manager'), capability: 'social.publish', client: other })).toEqual({ allowed: false, reason: 'not-assigned' });
    });
    it('ruolo sconosciuto o utente inattivo: nessuna capacità', () => {
        expect(decideAccess({ user: staff('admin'), capability: 'workspace.basic' }).reason).toBe('no-capability');
        expect(decideAccess({ user: staff('Amministratore', { status: 'Inattivo' }), capability: 'workspace.basic' }).allowed).toBe(false);
    });
    it('capacità non legate a un cliente non vogliono il cliente', () => {
        expect(decideAccess({ user: staff('Collaboratore'), capability: 'reports.ownHours' }).allowed).toBe(true);
    });
    it('budget e costi: con la spunta, e sul cliente assegnato', () => {
        expect(decideAccess({ user: staff('Project Manager'), capability: 'economics.view', client }).reason).toBe('no-capability');
        expect(decideAccess({ user: staff('Project Manager'), capability: 'economics.view', client, financialsGranted: true }).allowed).toBe(true);
    });
});

describe('shouldBlock', () => {
    const denied = { allowed: false, reason: 'not-assigned' as const };
    it('in osservazione non blocca mai', () => {
        expect(shouldBlock(denied, 'observe')).toBe(false);
    });
    it('in enforce blocca solo ciò che è negato', () => {
        expect(shouldBlock(denied, 'enforce')).toBe(true);
        expect(shouldBlock({ allowed: true }, 'enforce')).toBe(false);
    });
});

describe('describeDenial', () => {
    it('dice la modalità, il ruolo e la capacità, senza dati personali', () => {
        const line = describeDenial('observe', 'u1', 'Grafico', 'social.publish', 'a', 'no-capability');
        expect(line).toContain('solo osservazione');
        expect(line).toContain('Grafico');
        expect(line).toContain('social.publish');
        expect(describeDenial('enforce', 'u1', null, 'social.publish', undefined, 'no-user')).toContain('NEGATO');
    });
});
