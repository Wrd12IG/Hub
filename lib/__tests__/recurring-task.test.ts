import { describe, it, expect } from 'vitest';
import { expandTitleTokens, addWorkingDays, sanitizeDueOffset } from '../recurring-task';

// Mezzogiorno locale: nessun salto di giorno per il fuso orario
const d = (iso: string) => new Date(`${iso}T12:00:00`);

describe('expandTitleTokens', () => {
    it('mese e periodo', () => {
        expect(expandTitleTokens('Report – {mese}', d('2026-11-05'))).toBe('Report – novembre');
        expect(expandTitleTokens('Report – {periodo}', d('2026-11-05'))).toBe('Report – novembre 2026');
    });
    it('lo scarto: il report del mese scorso, il piano del prossimo', () => {
        expect(expandTitleTokens('Report mensile – {periodo-1}', d('2026-12-03'))).toBe('Report mensile – novembre 2026');
        expect(expandTitleTokens('Piano editoriale – {periodo+1}', d('2026-12-15'))).toBe('Piano editoriale – gennaio 2027');
        expect(expandTitleTokens('Report – {periodo-1}', d('2027-01-04'))).toBe('Report – dicembre 2026');
    });
    it('anno', () => {
        expect(expandTitleTokens('Bilancio {anno}', d('2026-12-31'))).toBe('Bilancio 2026');
        expect(expandTitleTokens('Bilancio {anno-1}', d('2027-01-04'))).toBe('Bilancio 2026');
    });
    it('trimestre, con l\'anno giusto anche a cavallo', () => {
        expect(expandTitleTokens('Audit – {trimestre}', d('2026-10-01'))).toBe('Audit – T4 2026');
        expect(expandTitleTokens('Audit – {trimestre-1}', d('2026-10-01'))).toBe('Audit – T3 2026');
        expect(expandTitleTokens('Audit – {trimestre-1}', d('2027-01-04'))).toBe('Audit – T4 2026');
    });
    it('settimana', () => {
        expect(expandTitleTokens('Ottimizzare campagne – {settimana}', d('2026-11-23'))).toBe('Ottimizzare campagne – sett. 48');
        expect(expandTitleTokens('{settimana+1}', d('2026-11-23'))).toBe('sett. 49');
    });
    it('più segnaposto, maiuscole e testo senza segnaposto', () => {
        expect(expandTitleTokens('{MESE} e {anno}', d('2026-03-10'))).toBe('marzo e 2026');
        expect(expandTitleTokens('Controllo del sito', d('2026-03-10'))).toBe('Controllo del sito');
    });
    it('un segnaposto sconosciuto resta com\'è', () => {
        expect(expandTitleTokens('Report {boh} {mese}', d('2026-03-10'))).toBe('Report {boh} marzo');
    });
});

describe('addWorkingDays', () => {
    it('zero giorni: lo stesso giorno', () => {
        expect(addWorkingDays(d('2026-11-25'), 0).getDate()).toBe(25);
        expect(addWorkingDays(d('2026-11-25'), -3).getDate()).toBe(25);
    });
    it('salta il fine settimana', () => {
        // venerdì 27/11 + 1 giorno lavorativo = lunedì 30/11
        const r = addWorkingDays(d('2026-11-27'), 1);
        expect([r.getFullYear(), r.getMonth() + 1, r.getDate()]).toEqual([2026, 11, 30]);
        // lunedì 23/11 + 4 = venerdì 27/11; + 5 = lunedì 30/11
        expect(addWorkingDays(d('2026-11-23'), 4).getDate()).toBe(27);
        expect(addWorkingDays(d('2026-11-23'), 5).getDate()).toBe(30);
    });
    it('non modifica la data ricevuta', () => {
        const base = d('2026-11-25');
        addWorkingDays(base, 3);
        expect(base.getDate()).toBe(25);
    });
});

describe('sanitizeDueOffset', () => {
    it('accetta interi tra 0 e 30 e li tronca', () => {
        expect(sanitizeDueOffset(2)).toBe(2);
        expect(sanitizeDueOffset('4')).toBe(4);
        expect(sanitizeDueOffset(2.9)).toBe(2);
    });
    it('tutto il resto vale 0 (nessun anticipo, come prima)', () => {
        for (const v of [undefined, null, '', 'abc', NaN, Infinity, -5, {}, []]) expect(sanitizeDueOffset(v)).toBe(0);
    });
    it('un valore enorme si ferma a 30', () => {
        expect(sanitizeDueOffset(400)).toBe(30);
    });
});
