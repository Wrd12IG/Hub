import { describe, it, expect } from 'vitest';
import { computeAlerts, hasEnoughBase, summarizeReport } from '../report-metrics';
import { withGbpContacts } from '../reporting';
import type { PlatformReport } from '../reporting';

const p = (platform: PlatformReport['platform'], cur: Record<string, number>, prev: Record<string, number> | null, label?: string): PlatformReport => ({
    platform, connected: true, accountLabel: label, rows: [cur], previousRows: prev ? [prev] : [],
});

describe('avvisi con base minima', () => {
    it('da 2 a 3 lead (+50%) non è un avviso: base sotto 10', () => {
        expect(computeAlerts([p('facebook', { leads: 3 }, { leads: 2 })])).toEqual([]);
    });

    it('da 40 a 80 lead (+100%) è un avviso positivo', () => {
        const a = computeAlerts([p('facebook', { leads: 80 }, { leads: 40 })]);
        expect(a).toHaveLength(1);
        expect(a[0]).toMatchObject({ key: 'leads', value: 100, good: true, platform: 'Meta Ads' });
    });

    it('la spesa che sale è una cattiva notizia, ma solo sopra 50 €', () => {
        expect(computeAlerts([p('facebook', { spend: 60 }, { spend: 20 })])).toEqual([]);
        const a = computeAlerts([p('facebook', { spend: 300 }, { spend: 200 })]);
        expect(a[0]).toMatchObject({ key: 'spend', value: 50, good: false });
    });

    it('CPC e CTR si confrontano solo con volume sufficiente', () => {
        expect(hasEnoughBase('cpc_calc', { clicks: 40 })).toBe(false);
        expect(hasEnoughBase('cpc_calc', { clicks: 400 })).toBe(true);
        expect(hasEnoughBase('ctr_pct', { impressions: 9000 })).toBe(true);
    });

    it('il rating medio non genera mai avvisi', () => {
        expect(computeAlerts([p('gbp', { review_average_rating_total: 3 }, { review_average_rating_total: 4.6 })])).toEqual([]);
    });

    it('sotto il 25% di variazione non avvisa', () => {
        expect(computeAlerts([p('facebook', { leads: 55 }, { leads: 50 })])).toEqual([]);
    });
});

describe('riepilogo', () => {
    it('City Motors: spesa, 51 lead, costo per lead 7,90', () => {
        const s = summarizeReport([
            p('ga4', { transactions: 0, conversions: 0, purchase_revenue: 0 }, { transactions: 0, conversions: 0, purchase_revenue: 0 }),
            p('facebook', { spend: 402.97, leads: 51 }, { spend: 380, leads: 30 }),
        ]);
        expect(s.spend).toEqual({ value: 402.97, previous: 380 });
        expect(s.result).toMatchObject({ label: 'lead', value: 51, previous: 30 });
        expect(s.costPerResult).toBe(7.9);
    });

    it('somma la spesa di Meta e Google', () => {
        const s = summarizeReport([p('facebook', { spend: 100 }, { spend: 80 }), p('google_ads', { cost: 50, conversions: 5 }, { cost: 60, conversions: 4 })]);
        expect(s.spend).toEqual({ value: 150, previous: 140 });
    });

    it('con l\'esito da GBP non divide la spesa dei canali a pagamento', () => {
        const gbp = { platform: 'gbp', connected: true, rows: [{ call_clicks: 40, direction_requests: 20, website_clicks: 20, contacts: 80 }], previousRows: [{ call_clicks: 30, direction_requests: 15, website_clicks: 15, contacts: 60 }] } as PlatformReport;
        const s = summarizeReport([p('facebook', { spend: 100 }, { spend: 100 }), gbp]);
        // Meta ha 0 lead, quindi l'esito è GBP: costo per risultato non calcolabile
        expect(s.result?.label).toBe('contatti');
        expect(s.costPerResult).toBeNull();
    });

    it('senza dati: tutto vuoto, nessun errore', () => {
        expect(summarizeReport([])).toMatchObject({ spend: null, result: null, costPerResult: null, alerts: [] });
    });
});

describe('contatti GBP', () => {
    it('somma chiamate, indicazioni e click sul sito; nessun valore se zero', () => {
        expect(withGbpContacts({ call_clicks: 10, direction_requests: 5, website_clicks: 7 }).contacts).toBe(22);
        expect(withGbpContacts({ call_clicks: 0 }).contacts).toBeUndefined();
    });
});
