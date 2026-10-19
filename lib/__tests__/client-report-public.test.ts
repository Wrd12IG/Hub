import { describe, it, expect } from 'vitest';
import { buildPublicReport, parsePeriod } from '../client-report-public';
import { cleanCommentText, isValidMonth, recentMonths } from '../monthly-comment';
import type { PlatformReport } from '../reporting';

const series = [
    { date: '2026-10-01', spend: 10, results: 1 },
    { date: '2026-10-02', spend: 20, results: 2 },
];

const platforms = [
    {
        platform: 'facebook', connected: true, accountLabel: 'ACCOUNT-INTERNO-123',
        rows: [{ spend: 300, leads: 30, account_id: 'act_999', account_name: 'Nome Interno' }],
        previousRows: [{ spend: 200, leads: 20 }], series,
    },
    { platform: 'google_ads', connected: true, rows: [{ cost: 100, conversions: 5 }], previousRows: [{ cost: 80, conversions: 4 }], series: [{ date: '2026-10-01', spend: 100, results: 5 }] },
    { platform: 'ga4', connected: false, error: 'invalid_grant: token scaduto per property 555', rows: [], previousRows: [] },
    { platform: 'klaviyo', connected: true, rows: [{ conversion_value: 9999 }], previousRows: [] },
] as unknown as PlatformReport[];

describe('pagina pubblica: dati esposti al cliente', () => {
    const out = buildPublicReport({
        clientName: 'Cliente Srl', days: 30, platforms, updatedAt: '2026-10-19T10:00:00.000Z',
        comment: { month: '2026-10', text: 'Ottimo mese.', updatedAt: '2026-10-19T09:00:00.000Z' },
    });
    const json = JSON.stringify(out);

    it('espone spesa totale, risultato e costo per risultato', () => {
        expect(out.summary.spend).toEqual({ value: 400, previous: 280 });
        expect(out.summary.result).toMatchObject({ label: 'lead', value: 30 });
        expect(out.summary.costPerResult).toBe(10);
        expect(out.trend?.points.length).toBe(2);
        expect(out.comment?.text).toBe('Ottimo mese.');
    });

    it('nessun campo interno esce: id e nomi di account, errori, avvisi, autore, token', () => {
        for (const leak of ['ACCOUNT-INTERNO', 'act_999', 'Nome Interno', 'invalid_grant', 'property 555', 'error', 'alerts', 'accountLabel', 'authorUid', 'publicToken', 'hourlyRate', '9999']) {
            expect(json).not.toContain(leak);
        }
    });

    it('le chiavi di primo livello sono solo quelle previste', () => {
        expect(Object.keys(out).sort()).toEqual(['clientName', 'comment', 'days', 'summary', 'trend', 'updatedAt']);
        expect(Object.keys(out.comment!).sort()).toEqual(['month', 'text', 'updatedAt']);
        expect(Object.keys(out.summary).sort()).toEqual(['costPerResult', 'result', 'spend']);
    });

    it('un commento con campi extra non li porta fuori', () => {
        const o = buildPublicReport({ clientName: 'X', days: 7, platforms: [], updatedAt: null, comment: { month: '2026-10', text: 't', updatedAt: null, authorUid: 'u1' } as any });
        expect(JSON.stringify(o)).not.toContain('u1');
    });

    it('senza piattaforme: tutto vuoto, nessun errore', () => {
        const o = buildPublicReport({ clientName: 'X', days: 7, platforms: [], updatedAt: null, comment: null });
        expect(o.summary).toEqual({ spend: null, result: null, costPerResult: null });
        expect(o.trend).toBeNull();
    });
});

describe('periodo e commento', () => {
    it('il periodo è solo 7, 30 o 90', () => {
        expect(parsePeriod('7')).toBe(7);
        expect(parsePeriod('90')).toBe(90);
        expect(parsePeriod('365')).toBe(30);
        expect(parsePeriod(null)).toBe(30);
        expect(parsePeriod('abc')).toBe(30);
    });
    it('mese valido solo come yyyy-MM', () => {
        expect(isValidMonth('2026-10')).toBe(true);
        expect(isValidMonth('2026-13')).toBe(false);
        expect(isValidMonth('2026-10-01')).toBe(false);
        expect(isValidMonth('../x')).toBe(false);
        expect(isValidMonth(undefined)).toBe(false);
    });
    it('testo: ripulito, limitato, solo stringhe', () => {
        expect(cleanCommentText('  ciao \r\nmondo ')).toBe('ciao \nmondo');
        expect(cleanCommentText('x'.repeat(4001))).toBeNull();
        expect(cleanCommentText(12)).toBeNull();
        expect(cleanCommentText('   ')).toBe('');
    });
    it('ultimi mesi, il corrente per primo, attraversa l\'anno', () => {
        expect(recentMonths(3, new Date(2026, 0, 15))).toEqual(['2026-01', '2025-12', '2025-11']);
    });
});
