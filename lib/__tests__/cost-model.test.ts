import { describe, it, expect } from 'vitest';
import { HOURLY_RATE, taskCost, activityCost, activityHours, activityClientIds } from '../cost-model';

describe('cost-model', () => {
    it('ogni ora vale 30 €, per task e attività, a prescindere dall\'utente', () => {
        expect(HOURLY_RATE).toBe(30);
        const t = taskCost({ timeSpent: 7200 });
        const act = activityCost({ startTime: '2026-10-01T09:00:00Z', endTime: '2026-10-01T11:00:00Z' });
        expect(t).toEqual(act);
        expect(t.cost).toBe(60);
    });

    it('task non assegnato o senza utente: costa comunque 30 €/h', () => {
        expect(taskCost({ timeSpent: 3600, assignedUserId: undefined } as any)).toEqual({ hours: 1, cost: 30 });
    });

    it('durate invalide o legacy start/end', () => {
        expect(activityHours({ startTime: '2026-10-01T11:00:00Z', endTime: '2026-10-01T09:00:00Z' })).toBe(0);
        expect(activityHours({ start: '2026-10-01T09:00:00Z', end: '2026-10-01T10:30:00Z' })).toBe(1.5);
        expect(activityClientIds({ clientId: 'x' })).toEqual(['x']);
    });
});
