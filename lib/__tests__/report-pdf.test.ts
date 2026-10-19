import { describe, it, expect } from 'vitest';
import { pdfRange, formatMetric, buildPdfSections, buildHighlights, pickChart } from '../report-pdf';
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

describe('sintesi in frasi', () => {
    it('risultato, spesa, costo e variazioni notevoli', () => {
        const h = buildHighlights({
            spend: { value: 623.47, previous: 640 },
            result: { label: 'lead', value: 51, previous: 30, source: 'Meta Ads — lead' },
            costPerResult: 7.9,
            alerts: [
                { platform: 'Meta Ads', key: 'leads', label: 'Lead', value: 70, good: true, from: 30, to: 51 },
                { platform: 'Instagram', key: 'reach', label: 'Reach', value: -30, good: false, from: 100, to: 70 },
            ],
        });
        expect(h[0]).toBe('51 lead nel periodo (+70% rispetto al periodo precedente), da Meta Ads.');
        expect(h[1]).toContain('€623,47');
        expect(h[1]).toContain('−2,6%');
        expect(h).toContain('Costo medio di ogni risultato (lead): €7,90.');
        expect(h).toContain('In crescita: Lead su Meta Ads +70%.');
        expect(h).toContain("Da tenere d'occhio: Reach su Instagram −30%.");
    });
    it('senza dati nessuna frase inventata', () => {
        expect(buildHighlights({ spend: null, result: null, costPerResult: null, alerts: [] })).toEqual([]);
    });
});

describe('grafico di una piattaforma', () => {
    const daily = (key: string, vals: number[]) => vals.map((v, i) => ({ date: `2026-09-${String(i + 1).padStart(2, '0')}`, [key]: v }));
    it('prende la prima metrica con dati', () => {
        const c = pickChart({ platform: 'searchconsole', connected: true, rows: [], daily: daily('clicks', [5, 7, 9, 3]) } as unknown as PlatformReport);
        expect(c).toMatchObject({ label: 'Click organici', euro: false });
        expect(c?.points).toHaveLength(4);
    });
    it('meno di 3 giorni o tutto zero: nessun grafico', () => {
        expect(pickChart({ platform: 'searchconsole', connected: true, rows: [], daily: daily('clicks', [5, 7]) } as unknown as PlatformReport)).toBeNull();
        expect(pickChart({ platform: 'searchconsole', connected: true, rows: [], daily: daily('clicks', [0, 0, 0, 0]) } as unknown as PlatformReport)).toBeNull();
    });
});
