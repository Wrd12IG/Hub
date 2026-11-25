import { describe, it, expect } from 'vitest';
import { briefTodo, isBriefOpen, statusAfterProjectCreated, CLIENT_STATUS_LABEL, BRIEF_STATUSES } from '../brief-status';
import type { Brief } from '../data';

const brief = (over: Partial<Brief>): Brief => ({
    id: 'b', clientId: 'c', projectName: 'P', title: 'T', contactPerson: '', mainObjective: '', selectedServiceIds: [],
    status: 'Inviato', createdAt: '2026-11-01T00:00:00.000Z', ...over,
});

describe('stati del brief', () => {
    it('ogni stato ha un testo per il cliente', () => {
        for (const s of BRIEF_STATUSES) expect(CLIENT_STATUS_LABEL[s]).toBeTruthy();
    });
    it('consegnato e bozza non sono «da chiudere»', () => {
        expect(isBriefOpen('Inviato')).toBe(true);
        expect(isBriefOpen('In Lavorazione')).toBe(true);
        expect(isBriefOpen('Consegnato')).toBe(false);
        expect(isBriefOpen('Bozza')).toBe(false);
    });
    it('creare il progetto porta in lavorazione chi non ci è ancora, e non tocca gli altri', () => {
        expect(statusAfterProjectCreated('Inviato')).toBe('In Lavorazione');
        expect(statusAfterProjectCreated('In Revisione')).toBe('In Lavorazione');
        expect(statusAfterProjectCreated('Approvato')).toBe('In Lavorazione');
        expect(statusAfterProjectCreated('Bozza')).toBe('Bozza');
        expect(statusAfterProjectCreated('Consegnato')).toBe('Consegnato');
    });
});

describe('briefTodo', () => {
    const today = '2026-11-25';
    it('divide i brief in da valutare, in corso e in ritardo', () => {
        const t = briefTodo([
            brief({ id: '1', status: 'Inviato' }),
            brief({ id: '2', status: 'Approvato' }),
            brief({ id: '3', status: 'In Lavorazione', deadline: '2026-11-20' }),
            brief({ id: '4', status: 'Consegnato', deadline: '2026-11-01' }),
            brief({ id: '5', status: 'Bozza', deadline: '2026-11-01' }),
        ], today);
        expect(t.toEvaluate.map((b) => b.id)).toEqual(['1']);
        expect(t.inProgress.map((b) => b.id)).toEqual(['2', '3']);
        expect(t.overdue.map((b) => b.id)).toEqual(['3']);
    });
    it('la scadenza di oggi non è ancora in ritardo', () => {
        expect(briefTodo([brief({ status: 'Approvato', deadline: '2026-11-25' })], today).overdue).toHaveLength(0);
    });
    it('i più vecchi vengono prima', () => {
        const t = briefTodo([
            brief({ id: 'nuovo', createdAt: '2026-11-20T00:00:00.000Z' }),
            brief({ id: 'vecchio', createdAt: '2026-11-02T00:00:00.000Z' }),
        ], today);
        expect(t.toEvaluate.map((b) => b.id)).toEqual(['vecchio', 'nuovo']);
    });
});
