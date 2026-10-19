import { describe, it, expect } from 'vitest';
import { normalizeObjective, presetDates, buildCampaignReport } from '../meta-campaign-report';

const NOW = new Date(2026, 9, 19, 12);

describe('obiettivi e periodi', () => {
    it('obiettivi Meta nuovi e vecchi', () => {
        expect(normalizeObjective('OUTCOME_LEADS')).toBe('LEADS');
        expect(normalizeObjective('OUTCOME_SALES')).toBe('SALES');
        expect(normalizeObjective('LINK_CLICKS')).toBe('TRAFFIC');
        expect(normalizeObjective('OUTCOME_ENGAGEMENT')).toBe('ENGAGEMENT');
        expect(normalizeObjective('OUTCOME_AWARENESS')).toBe('AWARENESS');
        expect(normalizeObjective('???')).toBe('ALTRO');
    });
    it('periodi del selettore', () => {
        expect(presetDates('last_30d', NOW)).toEqual({ from: '2026-09-20', to: '2026-10-19' });
        expect(presetDates('last_month', NOW)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
        expect(presetDates('this_month', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-19' });
        expect(presetDates('yesterday', NOW)).toEqual({ from: '2026-10-18', to: '2026-10-18' });
    });
});

describe('report campagna', () => {
    // Hilux OWE Settembre, dati reali di City Motors (90 giorni)
    const rows = [{ campaign_objective: 'OUTCOME_LEADS', spend: 117.92, impressions: 25795, reach: 7731, clicks: 534, actions_lead: 14, actions_landing_page_view: 1, actions_post_engagement: 398 }];

    it('lead: costo per lead e metriche di consegna ricalcolati', () => {
        const r = buildCampaignReport(rows);
        expect(r.objective).toBe('LEADS');
        expect(r.empty).toBe(false);
        expect(r.specific).toMatchObject({ leads: 14, costPerLead: 8.42, formCompletionRate: 2.62 });
        expect(r.base).toMatchObject({ spend: 117.92, clicks: 534, impressions: 25795 });
        expect(r.base.ctr).toBeCloseTo(2.07, 2);
        expect(r.base.frequency).toBeCloseTo(3.34, 2);
    });

    it('senza obiettivo lo deduce da cosa ha prodotto', () => {
        expect(buildCampaignReport([{ spend: 10, impressions: 100, clicks: 5, actions_lead: 2 }]).objective).toBe('LEADS');
        expect(buildCampaignReport([{ spend: 10, impressions: 100, clicks: 5, outbound_clicks_outbound_click: 3 }]).objective).toBe('TRAFFIC');
    });

    it('più righe (giorni) si sommano; i valori mancanti sono null, non zero inventati', () => {
        const r = buildCampaignReport([{ spend: 5, impressions: 1000, clicks: 10, reach: 800 }, { spend: 5, impressions: 1000, clicks: 10, reach: 900 }]);
        expect(r.base).toMatchObject({ spend: 10, impressions: 2000, clicks: 20, reach: 900 });
        expect(r.specific.costPerLead).toBeNull();
        expect(r.specific.roas).toBeNull();
    });

    it('nessuna riga: vuoto, non errore', () => {
        const r = buildCampaignReport([]);
        expect(r.empty).toBe(true);
        expect(r.base.spend).toBe(0);
    });
});
