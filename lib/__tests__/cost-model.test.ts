import { describe, it, expect } from 'vitest';
import { DEFAULT_HOURLY_RATE, rateOf, taskCost, activityCost, activityHours, activityClientIds } from '../cost-model';

const users = {
    a: { hourlyRate: 30 },
    b: { hourlyRate: '45,50' },
    c: {},
};

describe('cost-model', () => {
    it('il calcolo parte dal costo orario salvato nell\'utente', () => {
        expect(rateOf(users.a)).toBe(30);
        expect(rateOf(users.b)).toBe(45.5);
        expect(taskCost({ timeSpent: 7200, assignedUserId: 'b' }, users).cost).toBe(91);
    });

    it('utente senza tariffa, o task senza assegnatario: 30 €/h', () => {
        expect(DEFAULT_HOURLY_RATE).toBe(30);
        expect(rateOf(users.c)).toBe(30);
        expect(rateOf(undefined)).toBe(30);
        expect(taskCost({ timeSpent: 3600 }, users)).toEqual({ hours: 1, cost: 30 });
    });

    it('task e attività dello stesso utente costano uguale', () => {
        const t = taskCost({ timeSpent: 7200, assignedUserId: 'a' }, users);
        const act = activityCost({ userId: 'a', startTime: '2026-10-01T09:00:00Z', endTime: '2026-10-01T11:00:00Z' }, users);
        expect(t).toEqual(act);
        expect(t.cost).toBe(60);
    });

    it('durate invalide o legacy start/end', () => {
        expect(activityHours({ startTime: '2026-10-01T11:00:00Z', endTime: '2026-10-01T09:00:00Z' })).toBe(0);
        expect(activityHours({ start: '2026-10-01T09:00:00Z', end: '2026-10-01T10:30:00Z' })).toBe(1.5);
        expect(activityClientIds({ clientId: 'x' })).toEqual(['x']);
    });
});
