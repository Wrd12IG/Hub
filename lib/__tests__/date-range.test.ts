import { describe, it, expect } from 'vitest';
import { rangeDays, presetRange, validateRange, buildRangeWindows, rangeLabel } from '../date-range';

const NOW = new Date('2026-10-19T10:00:00Z');

describe('date-range', () => {
    it('conta i giorni con gli estremi inclusi', () => {
        expect(rangeDays('2026-10-01', '2026-10-30')).toBe(30);
        expect(rangeDays('2026-10-05', '2026-10-05')).toBe(1);
    });

    it('«ultimi 30 giorni» finisce oggi e dura 30 giorni', () => {
        const r = presetRange(30, NOW);
        expect(r).toEqual({ from: '2026-09-20', to: '2026-10-19' });
        expect(rangeDays(r.from, r.to)).toBe(30);
    });

    it('valida: date mancanti, invertite, nel futuro, troppo lunghe', () => {
        expect(validateRange('', '2026-10-01', NOW).ok).toBe(false);
        expect(validateRange('2026-10-10', '2026-10-01', NOW)).toMatchObject({ ok: false, error: expect.stringContaining('prima') });
        expect(validateRange('2026-10-01', '2026-10-25', NOW)).toMatchObject({ ok: false, error: expect.stringContaining('futuro') });
        expect(validateRange('2025-01-01', '2026-10-19', NOW)).toMatchObject({ ok: false, error: expect.stringContaining('366') });
        expect(validateRange('2026-02-31', '2026-03-05', NOW).ok).toBe(false);
        expect(validateRange('2026-10-01', '2026-10-15', NOW)).toEqual({ ok: true, range: { from: '2026-10-01', to: '2026-10-15' }, days: 15 });
    });

    it('confronto col periodo precedente: stessi giorni subito prima', () => {
        expect(buildRangeWindows('2026-10-11', '2026-10-20', 'prev_period')).toEqual({
            current: { dateFrom: '2026-10-11', dateTo: '2026-10-20' },
            previous: { dateFrom: '2026-10-01', dateTo: '2026-10-10' },
        });
    });

    it('confronto con l\'anno precedente: le stesse date un anno prima', () => {
        expect(buildRangeWindows('2026-10-01', '2026-10-15', 'prev_year').previous).toEqual({ dateFrom: '2025-10-01', dateTo: '2025-10-15' });
    });

    it('senza confronto non c\'è la finestra precedente', () => {
        expect(buildRangeWindows('2026-10-01', '2026-10-15', 'none').previous).toBeNull();
    });

    it('etichetta leggibile', () => {
        expect(rangeLabel('2026-10-01', '2026-10-15')).toMatch(/^dal 1 ott.* al 15 ott/);
    });
});
