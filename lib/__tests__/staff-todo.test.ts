import { describe, it, expect } from 'vitest';
import { pedTodo, staffTodo, taskTodo, taskSince, REMINDER_AFTER_DAYS } from '../staff-todo';
import { CLIENT_WAIT_REMINDER_DAYS } from '../task-model';
import type { Brief, EditorialContent, Task } from '../data';

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

const task = (over: Partial<Task> & { id: string }): Task =>
    ({ title: 't', clientId: 'c', status: 'In Lavorazione', priority: 'Media', estimatedDuration: 0, timeSpent: 0, ...over }) as Task;

describe('taskTodo', () => {
    it('«In attesa cliente» si sollecita solo dopo la soglia, dal più fermo', () => {
        const t = taskTodo([
            task({ id: 'fresco', status: 'In Approvazione Cliente', statusChangedAt: daysAgo(CLIENT_WAIT_REMINDER_DAYS - 1) }),
            task({ id: 'fermo', status: 'In Approvazione Cliente', statusChangedAt: daysAgo(CLIENT_WAIT_REMINDER_DAYS + 4) }),
            task({ id: 'fermo2', status: 'In Approvazione Cliente', statusChangedAt: daysAgo(CLIENT_WAIT_REMINDER_DAYS + 1) }),
            task({ id: 'altro', status: 'In Approvazione', statusChangedAt: daysAgo(30) }),
        ], now);
        expect(t.waitingClient.map((x) => x.id)).toEqual(['fermo', 'fermo2']);
    });
    it('per i task senza statusChangedAt ripiega su updatedAt', () => {
        expect(taskSince({ updatedAt: '2026-11-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z' })).toBe('2026-11-01T00:00:00.000Z');
        expect(taskSince({ createdAt: '2026-10-01T00:00:00.000Z' })).toBe('2026-10-01T00:00:00.000Z');
        expect(taskSince({})).toBeUndefined();
        const t = taskTodo([task({ id: 'a', status: 'In Approvazione Cliente', updatedAt: daysAgo(10) })], now);
        expect(t.waitingClient).toHaveLength(1);
    });
    it('un task in attesa cliente senza nessuna data non finisce nell\'elenco', () => {
        expect(taskTodo([task({ id: 'a', status: 'In Approvazione Cliente' })], now).waitingClient).toHaveLength(0);
    });
    it('i critici in ritardo: solo Critica, scaduta ieri o prima, non chiusa e non in mano al cliente', () => {
        const t = taskTodo([
            task({ id: 'ok', priority: 'Critica', dueDate: '2026-11-20T09:00:00.000Z' }),
            task({ id: 'oggi', priority: 'Critica', dueDate: '2026-11-25T09:00:00.000Z' }),
            task({ id: 'alta', priority: 'Alta', dueDate: '2026-11-20T09:00:00.000Z' }),
            task({ id: 'chiuso', priority: 'Critica', status: 'Approvato', dueDate: '2026-11-20T09:00:00.000Z' }),
            task({ id: 'archiviato', priority: 'Critica', status: 'Annullato', dueDate: '2026-11-20T09:00:00.000Z' }),
            task({ id: 'cliente', priority: 'Critica', status: 'In Approvazione Cliente', dueDate: '2026-11-20T09:00:00.000Z' }),
            task({ id: 'senzadata', priority: 'Critica' }),
        ], now);
        expect(t.criticalOverdue.map((x) => x.id)).toEqual(['ok']);
    });
    it('il totale di staffTodo li somma, e senza task vale come prima', () => {
        const tasks = [task({ id: 'a', priority: 'Critica', dueDate: '2026-11-20T09:00:00.000Z' })];
        expect(staffTodo({ briefs: [], contents: [], tasks, now }).total).toBe(1);
        expect(staffTodo({ briefs: [], contents: [], now }).total).toBe(0);
    });
});
