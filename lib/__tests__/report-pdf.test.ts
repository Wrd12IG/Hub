import { describe, it, expect } from 'vitest';
import { pdfRange, formatMetric, buildPdfSections } from '../report-pdf';
import type { PlatformReport } from '../reporting';

const NOW = new Date(2026, 9, 19, 12); // 19 ottobre 2026

describe('periodi', () => {
    it('mese scorso: dal 1 all\'ultimo giorno di settembre, commento di settembre', () => {
        expect(pdfRange('prevMonth', NOW)).toEqual({ from: '2026-09-01', to: '2026-09-30', commentMonth: '2026-09' });
    });
    it('mese in corso: dal 1 a oggi', () => {
        expect(pdfRange('thisMonth', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-19', commentMonth: '2026-10' });
    });
    it('ultimi 30 giorni: 30 giorni compresi', () => {
        expect(pdfRange('last30', NOW)).toMatchObject({ from: '2026-09-20', to: '2026-10-19' });
    });
    it('gennaio: il mese scorso è dicembre dell\'anno prima', () => {
        expect(pdfRange('prevMonth', new Date(2027, 0, 5))).toEqual({ from: '2026-12-01', to: '2026-12-31', commentMonth: '2026-12' });
    });
});

describe('formati', () => {
    it('euro, percentuali, decimali e interi', () => {
        expect(formatMetric('spend', 8271.76)).toBe('€8.271,76');
        expect(formatMetric('ctr_pct', 2.114)).toBe('2,1%');
        expect(formatMetric('position', 6.64)).toBe('6,6');
        expect(formatMetric('impressions', 687003)).toBe('687.003');
    });
});

describe('sezioni per piattaforma', () => {
    const fb = { platform: 'facebook', connected: true, rows: [{ spend: 402.97, leads: 51, cost_per_lead: 7.9 }], previousRows: [{ spend: 380, leads: 30, cost_per_lead: 12.67 }] } as unknown as PlatformReport;
    const off = { platform: 'ga4', connected: false, rows: [] } as unknown as PlatformReport;
    const zero = { platform: 'google_ads', connected: true, rows: [{ cost: 0, clicks: 0 }] } as unknown as PlatformReport;

    it('metriche con variazione e giudizio (il costo che scende è un bene)', () => {
        const [s] = buildPdfSections([fb]);
        expect(s.title).toBe('Meta Ads');
        const leads = s.rows.find((r) => r.label === 'Lead')!;
        expect(leads).toMatchObject({ value: '51', previous: '30', deltaPct: 70, good: true });
        expect(s.rows.find((r) => r.label === 'Costo per lead')).toMatchObject({ deltaPct: -37.6, good: true });
    });
    it('la spesa è neutra: nessun giudizio sul colore', () => {
        const [s] = buildPdfSections([fb]);
        expect(s.rows.find((r) => r.label === 'Spesa')).toMatchObject({ deltaPct: 6, good: null });
    });
    it('salta piattaforme non collegate e quelle tutte a zero', () => {
        expect(buildPdfSections([off, zero])).toEqual([]);
    });
});
