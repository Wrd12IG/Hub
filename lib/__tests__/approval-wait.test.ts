import { describe, it, expect } from 'vitest';
import { approvalWaitTone, approvalWaitLabel, approverName } from '../approval-wait';

describe('approval-wait', () => {
    it('gravità per giorni di attesa', () => {
        expect(approvalWaitTone(0)).toBe('fresh');
        expect(approvalWaitTone(1)).toBe('fresh');
        expect(approvalWaitTone(2)).toBe('warning');
        expect(approvalWaitTone(25)).toBe('late');
    });
    it('etichette', () => {
        expect(approvalWaitLabel(0)).toBe('oggi');
        expect(approvalWaitLabel(1)).toBe('1 g');
        expect(approvalWaitLabel(25)).toBe('25 gg');
    });
    const users = { u1: { name: 'Rebecca Gatto' }, u2: { name: 'Giulia Tarricone' } };
    it('approvatore interno: primo responsabile del cliente', () => {
        expect(approverName('In Approvazione', { managedBy: ['u1'], backupManagerId: 'u2' }, users)).toBe('Rebecca');
    });
    it('senza responsabile valido usa il backup', () => {
        expect(approverName('In Approvazione', { managedBy: ['sparito'], backupManagerId: 'u2' }, users)).toBe('Giulia');
    });
    it('attesa cliente indica il cliente', () => {
        expect(approverName('In Approvazione Cliente', { name: 'BREVI' }, users)).toBe('cliente BREVI');
    });
    it('altri stati: nessuno', () => {
        expect(approverName('Da Fare', { managedBy: ['u1'] }, users)).toBeNull();
    });
});
