import { describe, it, expect } from 'vitest';
import { findDataIssues } from '../data-quality';

const usersById = { u1: { name: 'Anna' } };
const clientsById = { c1: { name: 'Dalma' } };
const now = new Date('2026-10-17T00:00:00Z');

describe('findDataIssues', () => {
    it('task con ore senza assegnatario e senza cliente', () => {
        const r = findDataIssues({
            tasks: [
                { id: 't1', title: 'A', timeSpent: 7200, clientId: 'c1' },
                { id: 't2', title: 'B', timeSpent: 3600, assignedUserId: 'u1' },
                { id: 't3', title: 'C', timeSpent: 0 },
            ],
            activities: [], usersById, clientsById, now,
        });
        expect(r.tasksNoAssignee.map(t => t.id)).toEqual(['t1']);
        expect(r.tasksNoClient.map(t => t.id)).toEqual(['t2']);
        expect(r.unassignedClientHours).toBe(1);
        expect(r.unassignedClientCost).toBe(30);
    });

    it('attività senza cliente, senza utente, sospette', () => {
        const r = findDataIssues({
            tasks: [],
            activities: [
                { id: 'a1', title: 'ok', userId: 'u1', clientId: 'c1', startTime: '2026-10-01T09:00:00Z', endTime: '2026-10-01T10:00:00Z' },
                { id: 'a2', title: 'senza', startTime: '2026-10-01T09:00:00Z', endTime: '2026-10-01T10:00:00Z' },
                { id: 'a3', title: 'giornata', userId: 'u1', clientId: 'c1', startTime: '2026-10-01T00:00:00Z', endTime: '2026-10-03T00:00:00Z' },
                { id: 'a4', title: 'anno', userId: 'u1', clientId: 'c1', startTime: '2005-10-01T09:00:00Z', endTime: '2005-10-01T10:00:00Z' },
                { id: 'a5', title: 'inversa', userId: 'u1', clientId: 'c1', startTime: '2026-10-01T10:00:00Z', endTime: '2026-10-01T09:00:00Z' },
            ],
            usersById, clientsById, now,
        });
        expect(r.activitiesNoClient.map(a => a.id)).toEqual(['a2']);
        expect(r.activitiesNoUser.map(a => a.id)).toEqual(['a2']);
        expect(r.activitiesSuspicious.map(a => a.id).sort()).toEqual(['a3', 'a4', 'a5']);
        expect(r.suspiciousHours).toBe(49);
    });
});
