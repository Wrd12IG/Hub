import { describe, it, expect } from 'vitest';
import { computeLabourCost, monthWindow } from '../labour-cost';

const NOW = new Date(2026, 9, 21); // 21 ottobre 2026
const users = { u1: { hourlyRate: 40 }, u2: {} }; // u2: senza tariffa = 30 €/h
const names = { c1: 'City Motors', c2: 'Dalma' };
const H = 3600;

describe('finestra dei mesi', () => {
    it('tre mesi completi prima di ottobre', () => {
        expect(monthWindow(3, NOW)).toEqual({ months: ['2026-07', '2026-08', '2026-09'], current: '2026-10' });
    });
    it('a gennaio scavalca l\'anno', () => {
        expect(monthWindow(3, new Date(2027, 0, 10))).toEqual({ months: ['2026-10', '2026-11', '2026-12'], current: '2027-01' });
    });
});

describe('costo del lavoro per cliente', () => {
    it('ore per costo orario, media sui mesi completi', () => {
        const r = computeLabourCost({
            now: NOW, usersById: users, clientNames: names,
            tasks: [
                { clientId: 'c1', timeSpent: 10 * H, assignedUserId: 'u1', dueDate: '2026-09-15' }, // 10h × 40 = 400
                { clientId: 'c1', timeSpent: 20 * H, assignedUserId: 'u2', dueDate: '2026-08-10' }, // 20h × 30 = 600
                { clientId: 'c1', timeSpent: 5 * H, assignedUserId: 'u1', updatedAt: '2026-10-02T10:00:00Z' }, // mese in corso: 200
            ],
            activities: [],
        });
        const c = r.clients[0];
        expect(c.name).toBe('City Motors');
        expect(c.monthlyCost).toBe(333.33); // (0 + 600 + 400) / 3
        expect(c.monthlyHours).toBe(10);
        expect(c.currentMonth).toEqual({ hours: 5, cost: 200 });
    });

    it('attività su più clienti: divisa in parti uguali', () => {
        const r = computeLabourCost({
            now: NOW, usersById: users, clientNames: names, tasks: [],
            activities: [{ clientIds: ['c1', 'c2'], startTime: '2026-09-03T09:00:00Z', endTime: '2026-09-03T13:00:00Z', userId: 'u1' }], // 4h × 40 = 160 → 80 + 80
        });
        expect(r.clients.map((c) => [c.clientId, c.byMonth['2026-09'].cost])).toEqual(expect.arrayContaining([['c1', 80], ['c2', 80]]));
        expect(r.total.monthlyCost).toBe(53.33);
    });

    it('ignora i mesi fuori finestra, i task senza cliente e le ore a zero', () => {
        const r = computeLabourCost({
            now: NOW, usersById: users, clientNames: names,
            tasks: [
                { clientId: 'c1', timeSpent: 10 * H, assignedUserId: 'u1', dueDate: '2026-03-15' },
                { timeSpent: 10 * H, assignedUserId: 'u1', dueDate: '2026-09-15' },
                { clientId: 'c2', timeSpent: 0, assignedUserId: 'u1', dueDate: '2026-09-15' },
            ],
            activities: [],
        });
        expect(r.clients).toEqual([]);
        expect(r.total.monthlyCost).toBe(0);
    });
});
