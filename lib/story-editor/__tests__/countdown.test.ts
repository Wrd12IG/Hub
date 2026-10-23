import { describe, it, expect } from 'vitest';
import { formatCountdownEnd } from '../countdown';

describe('formatCountdownEnd', () => {
    it('data, ora e giorno della settimana in italiano', () => {
        expect(formatCountdownEnd('2026-10-25T18:00')).toEqual({ day: '25 OTT', time: '18:00', weekday: 'DOMENICA' });
        expect(formatCountdownEnd('2026-12-01T09:05')).toEqual({ day: '1 DIC', time: '09:05', weekday: 'MARTEDÌ' });
    });
    it('accetta anche i secondi', () => expect(formatCountdownEnd('2026-10-24T08:30:00')?.weekday).toBe('SABATO'));
    it('vuoto o non valido → null', () => {
        expect(formatCountdownEnd('')).toBeNull();
        expect(formatCountdownEnd(undefined)).toBeNull();
        expect(formatCountdownEnd('2026-13-40T99:99')).toBeNull();
        expect(formatCountdownEnd('domani')).toBeNull();
    });
});
