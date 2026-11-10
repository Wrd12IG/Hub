import { describe, it, expect } from 'vitest';
import { MANUAL_FIELD_IDS, cleanManualValues, fieldsForProfile, isMonthKey, parseManualCsv, previousMonthKey } from '../manual-kpis';
import { DEFAULT_RECIPIENTS, FALLBACK_SENDER, resolveSender, settingsOrDefault, splitRecipients, validateMailSettings } from '../monthly-mail-settings';

const clients = [
    { id: 'c1', name: 'BETTIN - BGF SRL' },
    { id: 'c2', name: 'CITY MOTORS' },
    { id: 'c3', name: 'Cà Bela' },
];

describe('manual-kpis: mesi', () => {
    it('chiave AAAA-MM valida', () => {
        expect(isMonthKey('2026-10')).toBe(true);
        expect(isMonthKey('2026-13')).toBe(false);
        expect(isMonthKey('2026-1')).toBe(false);
        expect(isMonthKey(202610)).toBe(false);
    });
    it('il mese del report è quello appena chiuso, anche a cavallo d\'anno e col fuso di Roma', () => {
        expect(previousMonthKey(new Date('2026-11-03T08:00:00+01:00'))).toBe('2026-10');
        expect(previousMonthKey(new Date('2027-01-03T08:00:00+01:00'))).toBe('2026-12');
        // 1 gennaio 00:30 a Roma è ancora 31 dicembre in UTC: conta Roma
        expect(previousMonthKey(new Date('2026-12-31T23:30:00Z'))).toBe('2026-12');
    });
});

describe('manual-kpis: valori', () => {
    it('campi noti, interi 0…1.000.000, null toglie il valore', () => {
        expect(cleanManualValues({ leads_real: 12, sales: 0, appointments: null })).toEqual({ ok: true, values: { leads_real: 12, sales: 0, appointments: null } });
        expect(cleanManualValues({ leads_real: -1 })).toMatchObject({ ok: false });
        expect(cleanManualValues({ leads_real: 1.5 })).toMatchObject({ ok: false });
        expect(cleanManualValues({ leads_real: '12' })).toMatchObject({ ok: false });
        expect(cleanManualValues({ leads_real: 2_000_000 })).toMatchObject({ ok: false });
        expect(cleanManualValues({ inventato: 3 })).toMatchObject({ ok: false, error: expect.stringMatching(/sconosciuto/) });
        expect(cleanManualValues([1])).toMatchObject({ ok: false });
        expect(cleanManualValues(null)).toMatchObject({ ok: false });
    });
    it('i campi sono quelli dei profili e ogni profilo vede i suoi', () => {
        expect(MANUAL_FIELD_IDS).toEqual(expect.arrayContaining(['leads_real', 'appointments', 'test_drives', 'sales', 'orders']));
        expect(fieldsForProfile('auto')).toEqual(['leads_real', 'appointments', 'test_drives', 'sales']);
        expect(fieldsForProfile('social')).toEqual([]);
        expect(fieldsForProfile(null)).toEqual([]);
    });
});

describe('manual-kpis: CSV', () => {
    it('legge il formato di Excel italiano (;), abbina i nomi senza badare ad accenti e segni', () => {
        const r = parseManualCsv('Cliente;Lead;Appuntamenti;Test drive;Vendite\nBettin – BGF S.r.l.;40;12;8;3\nca bela;5;;;', clients);
        expect(r.errors).toEqual([]);
        expect(r.rows).toEqual([
            { clientId: 'c1', name: 'BETTIN - BGF SRL', values: { leads_real: 40, appointments: 12, test_drives: 8, sales: 3 } },
            { clientId: 'c3', name: 'Cà Bela', values: { leads_real: 5 } },
        ]);
    });
    it('una cella vuota non tocca il valore (non diventa zero)', () => {
        const r = parseManualCsv('Cliente;Lead;Vendite\nCITY MOTORS;;4', clients);
        expect(r.rows[0].values).toEqual({ sales: 4 });
    });
    it('virgola e tab, BOM e virgolette', () => {
        expect(parseManualCsv('﻿cliente,lead\n"CITY MOTORS",7', clients).rows[0].values).toEqual({ leads_real: 7 });
        expect(parseManualCsv('cliente\tvendite\nCITY MOTORS\t2', clients).rows[0].values).toEqual({ sales: 2 });
    });
    it('un cliente sconosciuto e una colonna sconosciuta si segnalano, non si perdono in silenzio', () => {
        const r = parseManualCsv('Cliente;Lead;Note\nINESISTENTE;3;boh\nCITY MOTORS;1;x', clients);
        expect(r.unmatched).toEqual(['INESISTENTE']);
        expect(r.unknownColumns).toEqual(['Note']);
        expect(r.rows).toHaveLength(1);
    });
    it('un numero non intero scarta la riga e dice quale', () => {
        const r = parseManualCsv('Cliente;Lead\nCITY MOTORS;12,5\nBETTIN - BGF SRL;9', clients);
        expect(r.errors[0]).toMatch(/Riga 2.*CITY MOTORS.*12,5/);
        expect(r.rows.map((x) => x.clientId)).toEqual(['c1']);
    });
    it('senza colonna Cliente o senza righe è un errore chiaro', () => {
        expect(parseManualCsv('Lead\n3', clients).errors[0]).toMatch(/Cliente/);
        expect(parseManualCsv('Cliente;Lead', clients).errors[0]).toMatch(/almeno una riga/);
        expect(parseManualCsv('', clients).errors).toHaveLength(1);
    });
});

describe('monthly-mail-settings', () => {
    it('i destinatari concordati sono i predefiniti, il giorno è il 3', () => {
        expect(DEFAULT_RECIPIENTS).toEqual(['roberto@wrdigital.it', 'valentina@wrdigital.it', 'commerciale@wrdigital.it']);
        expect(settingsOrDefault(undefined)).toEqual({ recipients: DEFAULT_RECIPIENTS, sendDay: 3 });
        expect(settingsOrDefault({ recipients: ['no'], sendDay: 3 }).recipients).toEqual(DEFAULT_RECIPIENTS);
    });
    it('normalizza: minuscolo, senza doppioni', () => {
        expect(validateMailSettings({ recipients: ['A@x.it', 'a@x.it ', 'b@y.com'], sendDay: 5 })).toEqual({ ok: true, settings: { recipients: ['a@x.it', 'b@y.com'], sendDay: 5 } });
    });
    it('rifiuta indirizzi sbagliati, elenco vuoto o troppo lungo, giorni che non esistono ogni mese', () => {
        expect(validateMailSettings({ recipients: ['non-una-mail'], sendDay: 3 })).toMatchObject({ ok: false, error: expect.stringMatching(/non valido/) });
        expect(validateMailSettings({ recipients: [], sendDay: 3 })).toMatchObject({ ok: false });
        expect(validateMailSettings({ recipients: Array.from({ length: 21 }, (_, i) => `u${i}@x.it`), sendDay: 3 })).toMatchObject({ ok: false });
        expect(validateMailSettings({ recipients: ['a@x.it'], sendDay: 0 })).toMatchObject({ ok: false });
        expect(validateMailSettings({ recipients: ['a@x.it'], sendDay: 29 })).toMatchObject({ ok: false });
        expect(validateMailSettings({ recipients: ['a@x.it'], sendDay: '3' })).toMatchObject({ ok: false });
        expect(validateMailSettings(null)).toMatchObject({ ok: false });
    });
    it('splitRecipients accetta virgole, punti e virgola, spazi e righe', () => {
        expect(splitRecipients('a@x.it, B@x.it;c@x.it\nA@x.it')).toEqual(['a@x.it', 'b@x.it', 'c@x.it']);
        expect(splitRecipients('')).toEqual([]);
    });
});

describe('monthly-mail-settings: mittente', () => {
    it('come le notifiche del Hub, che arrivano: hub@wrdigital.it', () => {
        expect(resolveSender(undefined, undefined)).toEqual(FALLBACK_SENDER);
        expect(FALLBACK_SENDER.address).toBe('hub@wrdigital.it');
        expect(resolveSender(undefined, { emailFromName: 'Altro nome', emailFromAddress: 'noreply@wrdigital.it' })).toEqual({ name: 'Altro nome', address: 'noreply@wrdigital.it' });
    });
    it('la variabile d\'ambiente vince, ma solo se è un indirizzo vero', () => {
        expect(resolveSender('roberto@wrdigital.it', { emailFromAddress: 'hub@wrdigital.it' }).address).toBe('roberto@wrdigital.it');
        expect(resolveSender('non-una-mail', { emailFromAddress: 'hub@wrdigital.it' }).address).toBe('hub@wrdigital.it');
    });
    it('un indirizzo rovinato nelle impostazioni ricade sul predefinito; il nome non può iniettare intestazioni', () => {
        expect(resolveSender(undefined, { emailFromAddress: 'boh' }).address).toBe('hub@wrdigital.it');
        expect(resolveSender(undefined, { emailFromName: 'A\r\nBcc: x@y.it', emailFromAddress: 'a@b.it' }).name).toBe('ABcc: x@y.it');
        expect(resolveSender(undefined, { emailFromName: '   ' }).name).toBe(FALLBACK_SENDER.name);
    });
});
