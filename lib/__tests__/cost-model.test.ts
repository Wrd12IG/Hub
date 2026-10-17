import { describe, it, expect } from 'vitest';
import { computeHourlyOverhead, rateFor, taskCost, activityCost, activityHours, activityClientIds, parseRate } from '../cost-model';

const users = {
    a: { id: 'a', role: 'Collaboratore', hourlyRate: '12,50' },
    b: { id: 'b', role: 'Project Manager', hourlyRate: 20 },
    c: { id: 'c', role: 'Collaboratore', hourlyRate: 10, status: 'Inattivo' },
    boss: { id: 'boss', role: 'Amministratore', hourlyRate: 40 },
};

describe('cost-model', () => {
    it('parseRate accetta la virgola italiana', () => {
        expect(parseRate('12,50')).toBe(12.5);
        expect(parseRate(undefined)).toBe(0);
    });

    it('overhead: costi fissi / dipendenti attivi / 160, esclusi inattivi e admin', () => {
        // 2 attivi (a, b): 3200 / 2 / 160 = 10
        expect(computeHourlyOverhead({ dirigenza: 2000, struttura: 1000, varie: 200 }, Object.values(users))).toBe(10);
        expect(computeHourlyOverhead(null, Object.values(users))).toBe(0);
    });

    it('overhead solo a Collaboratori e PM', () => {
        expect(rateFor(users.a, 10).effective).toBe(22.5);
        expect(rateFor(users.boss, 10).effective).toBe(40);
    });

    it('task e attività con lo stesso utente e le stesse ore costano uguale', () => {
        const t = taskCost({ assignedUserId: 'a', timeSpent: 7200 }, users, 10);
        const act = activityCost({ userId: 'a', startTime: '2026-10-01T09:00:00Z', endTime: '2026-10-01T11:00:00Z' }, users, 10);
        expect(t).toEqual(act);
        expect(t.cost).toBe(45);
    });

    it('task non assegnato: ore contate, costo 0', () => {
        expect(taskCost({ timeSpent: 3600 }, users, 10)).toEqual({ hours: 1, cost: 0 });
    });

    it('durate invalide o legacy start/end', () => {
        expect(activityHours({ startTime: '2026-10-01T11:00:00Z', endTime: '2026-10-01T09:00:00Z' })).toBe(0);
        expect(activityHours({ start: '2026-10-01T09:00:00Z', end: '2026-10-01T10:30:00Z' })).toBe(1.5);
        expect(activityClientIds({ clientId: 'x' })).toEqual(['x']);
    });
});
