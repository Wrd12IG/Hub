import { describe, it, expect } from 'vitest';
import { clientWorkSummary } from '../client-work-summary';

describe('clientWorkSummary', () => {
    const today = new Date('2026-11-27T10:00:00');
    const tasks = [
        { clientId: 'c1', status: 'Da Fare', dueDate: '2026-11-26' },          // scaduto
        { clientId: 'c1', status: 'In Lavorazione', dueDate: '2026-11-27' },   // oggi: non scaduto
        { clientId: 'c1', status: 'In Approvazione', dueDate: '2026-11-01' },  // in approvazione: non conta come scaduto
        { clientId: 'c1', status: 'In Approvazione Cliente' },
        { clientId: 'c1', status: 'Approvato', dueDate: '2026-10-01' },        // chiuso
        { clientId: 'c2', status: 'Da Fare', dueDate: '2026-11-01' },          // altro cliente
    ];
    it('conta solo i task aperti del cliente', () => {
        expect(clientWorkSummary(tasks, 'c1', today)).toEqual({ open: 4, overdue: 1, inApproval: 1, waitingClient: 1 });
    });
    it('cliente senza task', () => {
        expect(clientWorkSummary(tasks, 'zz', today)).toEqual({ open: 0, overdue: 0, inApproval: 0, waitingClient: 0 });
    });
});
