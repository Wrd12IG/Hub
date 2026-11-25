import { describe, it, expect } from 'vitest';
import { pedTodo, staffTodo, REMINDER_AFTER_DAYS } from '../staff-todo';
import type { Brief, EditorialContent } from '../data';

const now = new Date('2026-11-25T10:00:00.000Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();

const content = (over: { id?: string; status?: string; approvalStatus?: 'requested' | 'approved' | 'changes'; requestedAt?: string }): EditorialContent =>
    ({
        id: over.id || 'x',
        status: over.status || 'In Approvazione',
        ...(over.approvalStatus ? { approval: { status: over.approvalStatus, requestedAt: over.requestedAt || daysAgo(1) } } : {}),
    }) as unknown as EditorialContent;

describe('pedTodo', () => {
    it('le modifiche chieste dal cliente toccano a noi, subito', () => {
        const t = pedTodo([content({ id: 'a', approvalStatus: 'changes', requestedAt: daysAgo(0) })], now);
        expect(t.changesRequested.map((c) => c.id)).toEqual(['a']);
    });
    it('chi non risponde si sollecita solo dopo qualche giorno', () => {
        const t = pedTodo([
            content({ id: 'fresco', approvalStatus: 'requested', requestedAt: daysAgo(REMINDER_AFTER_DAYS - 1) }),
            content({ id: 'fermo', approvalStatus: 'requested', requestedAt: daysAgo(REMINDER_AFTER_DAYS + 2) }),
        ], now);
        expect(t.waitingClient.map((c) => c.id)).toEqual(['fermo']);
    });
    it('i contenuti già pubblicati e quelli approvati non contano', () => {
        const t = pedTodo([
            content({ id: 'p', status: 'Pubblicato', approvalStatus: 'changes' }),
            content({ id: 'ok', approvalStatus: 'approved', requestedAt: daysAgo(20) }),
        ], now);
        expect(t.changesRequested).toHaveLength(0);
        expect(t.waitingClient).toHaveLength(0);
    });
});

describe('staffTodo', () => {
    it('somma brief e PED, e senza niente da fare vale zero', () => {
        expect(staffTodo({ briefs: [], contents: [], now }).total).toBe(0);
        const briefs = [{ id: 'b', status: 'Inviato', createdAt: daysAgo(2), clientId: 'c', title: 't', projectName: 'p', contactPerson: '', mainObjective: '', selectedServiceIds: [] }] as Brief[];
        const contents = [content({ approvalStatus: 'changes' })];
        expect(staffTodo({ briefs, contents, now }).total).toBe(2);
    });
});
