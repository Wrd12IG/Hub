// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { computeClientMonthly, platformsNeeded } from '@/lib/kpi-compute';
import { DEALER_KPI_IDS, DEALER_KPI_GROUPS, KPI_CATALOG } from '@/lib/kpi-profiles';
import type { PlatformReport } from '@/lib/reporting';

const rep = (platform: PlatformReport['platform'], cur: Record<string, number>, prev: Record<string, number> = {}): PlatformReport =>
    ({ platform, connected: true, rows: [cur], previousRows: [prev] }) as PlatformReport;

const main: PlatformReport[] = [
    rep('ga4', { sessions: 1000, active_users: 800 }, { sessions: 800, active_users: 700 }),
    rep('facebook', { spend: 600, impressions: 120000, reach: 45000, leads: 40 }, { spend: 500, impressions: 100000, reach: 40000 }),
    rep('google_ads', { cost: 400, impressions: 30000, clicks: 1500, conversions: 25 }, { cost: 380, impressions: 28000, clicks: 1400, conversions: 20 }),
    rep('gbp', { call_clicks: 55, direction_requests: 80 }, { call_clicks: 40, direction_requests: 70 }),
];
const manual = {
    current: { leads_real: 60, appointments: 20, quotes: 12, sales: 5, leads_paid: 50, leads_sheet_google: 20, leads_sheet_meta: 30 },
    previous: { leads_real: 50, leads_paid: 40 },
};

function kpi(id: string, input = {}) {
    const r = computeClientMonthly({ clientId: 'c', name: 'Test', profile: 'auto', kpiIds: DEALER_KPI_IDS, month: '2026-10', main, yoy: [], manual, ...input });
    return r.kpis.find((k) => k.id === id)!;
}

describe('KPI del concessionario', () => {
    it('il catalogo è coerente: ogni id dei gruppi esiste ed è unico', () => {
        expect(new Set(DEALER_KPI_IDS).size).toBe(DEALER_KPI_IDS.length);
        for (const id of DEALER_KPI_IDS) expect(KPI_CATALOG[id], id).toBeTruthy();
        expect(DEALER_KPI_GROUPS.length).toBeGreaterThanOrEqual(6);
    });
    it('sito: sessioni e utenti, con il confronto sul mese prima', () => {
        expect(kpi('sessions').value).toBe(1000);
        expect(kpi('users')).toMatchObject({ value: 800, previous: 700 });
        expect(kpi('users').vsPrev?.kind).toBe('pct');
    });
    it('Meta Ads: impression, copertura, spesa', () => {
        expect(kpi('meta_impressions').value).toBe(120000);
        expect(kpi('meta_reach')).toMatchObject({ value: 45000, previous: 40000 });
        expect(kpi('meta_spend').value).toBe(600);
    });
    it('Google Ads: impression, click, spesa, conversioni', () => {
        expect(kpi('gads_impressions').value).toBe(30000);
        expect(kpi('gads_clicks').value).toBe(1500);
        expect(kpi('gads_spend').value).toBe(400);
        expect(kpi('gads_conversions')).toMatchObject({ value: 25, previous: 20 });
    });
    it('Google Maps e dati dello Sheet (lead, appuntamenti, preventivi, vendite)', () => {
        expect(kpi('gbp_calls').value).toBe(55);
        expect(kpi('gbp_directions').value).toBe(80);
        expect([kpi('leads_real').value, kpi('appointments').value, kpi('quotes').value, kpi('sales').value]).toEqual([60, 20, 12, 5]);
    });
    it('costo per lead: spesa Google + Meta divisa per i lead dei SOLI canali a pagamento', () => {
        // (600 + 400) / 50 lead da Google e Meta = 20 €  (non diviso per i 60 lead totali, che includono telefono e showroom)
        expect(kpi('cost_per_lead_total').value).toBe(20);
        expect(kpi('cpl_google').value).toBe(20);   // 400 / 20
        expect(kpi('cpl_meta_real').value).toBe(20); // 600 / 30
    });
    it('senza lead dallo Sheet il costo per lead è vuoto, non inventato; mai divisione per zero', () => {
        const none = { current: { leads_real: 10 }, previous: {} };
        expect(kpi('cost_per_lead_total', { manual: none }).value).toBeNull();
        expect(kpi('cost_per_lead_total', { manual: { current: { leads_paid: 0 }, previous: {} } }).value).toBeNull();
        expect(kpi('cost_per_lead_total', { manual: none }).missing).toBeTruthy();
    });
    it('una fonte non collegata dà «nessun dato», non zero', () => {
        const noGads = main.filter((p) => p.platform !== 'google_ads');
        expect(kpi('gads_clicks', { main: noGads }).value).toBeNull();
        // la spesa totale c'è ancora (solo Meta), ma il costo per lead Google non si può calcolare
        expect(kpi('cpl_google', { main: noGads }).value).toBeNull();
    });
    it('un dato dello Sheet assente resta «Dato non inserito»', () => {
        expect(kpi('quotes', { manual: { current: {}, previous: {} } })).toMatchObject({ value: null, missing: 'Dato non inserito' });
    });
    it('legge solo le piattaforme che servono', () => {
        expect(Array.from(platformsNeeded(['users'])).sort()).toEqual(['ga4']);
        expect(Array.from(platformsNeeded(['meta_reach', 'gads_clicks'])).sort()).toEqual(['facebook', 'google_ads']);
        expect(Array.from(platformsNeeded(['cost_per_lead_total'])).sort()).toEqual(['facebook', 'google_ads']);
        expect(Array.from(platformsNeeded(['quotes'])).length).toBe(0);
    });
});
