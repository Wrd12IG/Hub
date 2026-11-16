import { describe, it, expect } from 'vitest';
import { MAX_ATTEMPTS, isFresh, planRun, romeDateKey, splitWork } from '../monthly-mail-run';

// 16 novembre 2026, 10:00 a Roma → il mese da raccontare è ottobre
const at = (iso: string) => new Date(iso);
const NOV16 = at('2026-11-16T09:00:00Z');
const NOV02 = at('2026-11-02T09:00:00Z');
const NOV03 = at('2026-11-03T05:30:00Z');

describe('planRun', () => {
    it('prima del giorno di invio aspetta', () => {
        const p = planRun({ now: NOV02, sendDay: 3 });
        expect(p.action).toBe('wait');
    });
    it('dal giorno di invio gira sul mese appena chiuso, con cutoff al giorno di invio', () => {
        expect(planRun({ now: NOV03, sendDay: 3 })).toEqual({ action: 'run', month: '2026-10', cutoff: '2026-11-03' });
    });
    it('se il giorno è passato recupera, e il cutoff resta il giorno di invio', () => {
        expect(planRun({ now: NOV16, sendDay: 3 })).toEqual({ action: 'run', month: '2026-10', cutoff: '2026-11-03' });
    });
    it('a cavallo d\'anno: a gennaio si racconta dicembre', () => {
        expect(planRun({ now: at('2027-01-05T09:00:00Z'), sendDay: 3 })).toEqual({ action: 'run', month: '2026-12', cutoff: '2027-01-03' });
    });
    it('force ignora il giorno e ricalcola da oggi', () => {
        expect(planRun({ now: NOV02, sendDay: 3, force: true })).toEqual({ action: 'run', month: '2026-10', cutoff: '2026-11-02' });
    });
    it('un mese preciso solo con force, e deve essere valido', () => {
        expect(planRun({ now: NOV16, sendDay: 3, month: '2026-09' }).action).toBe('wait');
        expect(planRun({ now: NOV16, sendDay: 3, force: true, month: '2026-9' }).action).toBe('wait');
        expect(planRun({ now: NOV16, sendDay: 3, force: true, month: '2026-09' })).toEqual({ action: 'run', month: '2026-09', cutoff: '2026-11-16' });
    });
    it('il giorno è quello di Roma: le 23:30 UTC del 2 sono già il 3', () => {
        expect(romeDateKey(at('2026-11-02T23:30:00Z'))).toBe('2026-11-03');
        expect(planRun({ now: at('2026-11-02T23:30:00Z'), sendDay: 3 }).action).toBe('run');
    });
});

describe('isFresh / splitWork', () => {
    it('fresca se calcolata dal cutoff in poi, vecchia se prima, mancante se assente', () => {
        expect(isFresh('2026-11-03T08:00:00Z', '2026-11-03')).toBe(true);
        expect(isFresh('2026-11-01T08:00:00Z', '2026-11-03')).toBe(false);
        expect(isFresh(undefined, '2026-11-03')).toBe(false);
        expect(isFresh('boh', '2026-11-03')).toBe(false);
    });
    it('divide: da fare, già freschi, rassegnati dopo troppi tentativi', () => {
        const r = splitWork([
            { id: 'a', computedAt: '2026-11-03T08:00:00Z', attempts: 0 },
            { id: 'b', computedAt: '2026-10-20T08:00:00Z', attempts: 1 },
            { id: 'c', attempts: 0 },
            { id: 'd', computedAt: '2026-10-20T08:00:00Z', attempts: MAX_ATTEMPTS },
        ], '2026-11-03');
        expect(r).toEqual({ todo: ['b', 'c'], gaveUp: ['d'] });
    });
});
