import { describe, it, expect } from 'vitest';
import { subtractWorkingDays, proposeWorkplan } from '../content-workplan';

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const ymd = (x: Date) => x.toISOString().slice(0, 10);

describe('subtractWorkingDays', () => {
    it('salta il weekend', () => expect(ymd(subtractWorkingDays(d('2026-10-26'), 1))).toBe('2026-10-23')); // lun → ven
    it('0 giorni = stesso giorno feriale', () => expect(ymd(subtractWorkingDays(d('2026-10-28'), 0))).toBe('2026-10-28'));
    it('partenza di sabato conta come venerdì', () => expect(ymd(subtractWorkingDays(d('2026-10-24'), 0))).toBe('2026-10-23'));
    it('cinque giorni lavorativi = una settimana', () => expect(ymd(subtractWorkingDays(d('2026-10-30'), 5))).toBe('2026-10-23'));
});

describe('proposeWorkplan', () => {
    it('proposta completa all\'indietro, in ordine cronologico', () => {
        const p = proposeWorkplan('2026-11-20', '2026-10-22')!;
        expect(p.map((t) => t.dueDate)).toEqual(['2026-11-11', '2026-11-13', '2026-11-17', '2026-11-18', '2026-11-20']);
        expect(p.every((t) => !t.late)).toBe(true);
    });
    it('scadenze già passate vengono portate a oggi e segnate in ritardo', () => {
        const p = proposeWorkplan('2026-10-27', '2026-10-22')!;
        expect(p[0]).toMatchObject({ dueDate: '2026-10-22', late: true });
        expect(p[4]).toMatchObject({ dueDate: '2026-10-27', late: false });
    });
    it('pubblicazione passata o senza data → null', () => {
        expect(proposeWorkplan('2026-10-01', '2026-10-22')).toBeNull();
        expect(proposeWorkplan(undefined, '2026-10-22')).toBeNull();
    });
    it('accetta una data ISO con orario', () => expect(proposeWorkplan('2026-11-20T09:00:00.000Z', '2026-10-22')).not.toBeNull());
});
