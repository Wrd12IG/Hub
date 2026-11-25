import { describe, it, expect } from 'vitest';
import { FLOW_STATUSES, STATUS_LABEL, statusLabel, isArchivedTask, isClosedTask, isWaitingOnClient, PRIORITY_RULES, DEFAULT_PRIORITY } from '../task-model';
import { allTaskStatuses, allTaskPriorities } from '../data';

describe('stati del flusso', () => {
    it('sono cinque e non includono l\'archivio', () => {
        expect(FLOW_STATUSES).toHaveLength(5);
        expect(FLOW_STATUSES).not.toContain('Annullato');
    });
    it('insieme all\'archivio coprono tutti i valori che il database può avere', () => {
        expect([...FLOW_STATUSES, 'Annullato'].sort()).toEqual([...allTaskStatuses].sort());
    });
    it('«In Approvazione Cliente» si legge «In attesa cliente»; il valore salvato non cambia', () => {
        expect(statusLabel('In Approvazione Cliente')).toBe('In attesa cliente');
        expect(FLOW_STATUSES).toContain('In Approvazione Cliente');
    });
    it('l\'archivio si legge «Archiviato»', () => {
        expect(statusLabel('Annullato')).toBe('Archiviato');
    });
    it('un valore sconosciuto o vuoto non rompe nulla', () => {
        expect(statusLabel('Boh')).toBe('Boh');
        expect(statusLabel(undefined)).toBe('');
        expect(statusLabel(null)).toBe('');
    });
    it('ogni stato ha un testo', () => {
        for (const s of allTaskStatuses) expect(STATUS_LABEL[s]).toBeTruthy();
    });
});

describe('chiuso, archiviato, in attesa del cliente', () => {
    it('approvato e archiviato sono chiusi; gli altri no', () => {
        expect(isClosedTask({ status: 'Approvato' })).toBe(true);
        expect(isClosedTask({ status: 'Annullato' })).toBe(true);
        expect(isClosedTask({ status: 'In Lavorazione' })).toBe(false);
        expect(isArchivedTask({ status: 'Annullato' })).toBe(true);
        expect(isArchivedTask({ status: 'Approvato' })).toBe(false);
    });
    it('solo «In Approvazione Cliente» è la palla al cliente', () => {
        expect(isWaitingOnClient({ status: 'In Approvazione Cliente' })).toBe(true);
        expect(isWaitingOnClient({ status: 'In Approvazione' })).toBe(false);
    });
});

describe('priorità', () => {
    it('ogni priorità ha la sua regola e il default è Media', () => {
        for (const p of allTaskPriorities) expect(PRIORITY_RULES[p]).toBeTruthy();
        expect(DEFAULT_PRIORITY).toBe('Media');
        expect(allTaskPriorities).toHaveLength(4);
    });
});
