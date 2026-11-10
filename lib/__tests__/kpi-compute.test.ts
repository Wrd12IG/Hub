import { describe, it, expect } from 'vitest';
import type { PlatformReport } from '../reporting';
import { compareDelta, computeClientMonthly, formatDelta, formatValue, monthLabel, monthRange, platformsNeeded, rawKpi, shiftMonth, verdictOf } from '../kpi-compute';

const rep = (platform: PlatformReport['platform'], rows: Record<string, number>, previousRows: Record<string, number> = {}, connected = true): PlatformReport =>
    ({ platform, connected, rows: [rows], previousRows: Object.keys(previousRows).length ? [previousRows] : [] });

describe('kpi-compute: mesi', () => {
    it('sposta i mesi anche a cavallo d\'anno', () => {
        expect(shiftMonth('2026-10', -1)).toBe('2026-09');
        expect(shiftMonth('2026-01', -1)).toBe('2025-12');
        expect(shiftMonth('2026-10', -12)).toBe('2025-10');
        expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    });
    it('primo e ultimo giorno, febbraio bisestile compreso', () => {
        expect(monthRange('2026-10')).toEqual({ dateFrom: '2026-10-01', dateTo: '2026-10-31' });
        expect(monthRange('2026-02')).toEqual({ dateFrom: '2026-02-01', dateTo: '2026-02-28' });
        expect(monthRange('2028-02')).toEqual({ dateFrom: '2028-02-01', dateTo: '2028-02-29' });
    });
    it('etichetta in italiano', () => expect(monthLabel('2026-10')).toBe('ottobre 2026'));
});

describe('kpi-compute: valori dalle piattaforme', () => {
    const main = [
        rep('facebook', { spend: 600, leads: 30 }, { spend: 500, leads: 25 }),
        rep('google_ads', { cost: 400 }, { cost: 300 }),
        rep('ga4', { sessions: 5000, purchase_revenue: 8000, transactions: 80 }, { sessions: 4000, purchase_revenue: 6000, transactions: 60 }),
        rep('gbp', { call_clicks: 40, direction_requests: 25, review_count: 4, review_average_rating_total: 4.6 }),
    ];
    it('lead e costo per lead da Meta', () => {
        expect(rawKpi('leads_meta', main, 'current', undefined)).toEqual({ value: 30, kind: 'real' });
        expect(rawKpi('cost_per_lead', main, 'current', undefined).value).toBe(20);
        expect(rawKpi('cost_per_lead', main, 'previous', undefined).value).toBe(20);
    });
    it('spesa = Meta + Google Ads; ROAS = fatturato sito / spesa di tutti i canali', () => {
        expect(rawKpi('ads_spend', main, 'current', undefined).value).toBe(1000);
        expect(rawKpi('roas', main, 'current', undefined).value).toBe(8);
        expect(rawKpi('cpa', main, 'current', undefined).value).toBe(12.5);
    });
    it('tasso di conversione in percentuale', () => expect(rawKpi('conversion_rate', main, 'current', undefined).value).toBe(1.6));
    it('GBP: contatti sommati, valutazione mai sommata (media fra sedi)', () => {
        const two = [rep('gbp', { call_clicks: 10, review_average_rating_total: 4.0 }), rep('gbp', { call_clicks: 5, review_average_rating_total: 5.0 })];
        expect(rawKpi('gbp_calls', two, 'current', undefined).value).toBe(15);
        expect(rawKpi('review_rating', two, 'current', undefined).value).toBe(4.5);
    });
    it('un KPI senza fonte è null, non zero', () => {
        expect(rawKpi('sessions', [], 'current', undefined)).toEqual({ value: null, kind: null });
        expect(rawKpi('search_clicks', [rep('ga4', { sessions: 1 })], 'current', undefined).value).toBeNull();
        expect(rawKpi('cost_per_lead', [rep('facebook', { spend: 100, leads: 0 })], 'current', undefined).value).toBeNull();
    });
    it('una fonte non collegata non conta', () => {
        expect(rawKpi('sessions', [rep('ga4', { sessions: 99 }, {}, false)], 'current', undefined).value).toBeNull();
    });
    it('i ricavi non si sommano: vince la fonte più ampia', () => {
        const p = [rep('ga4', { purchase_revenue: 1000 }), rep('klaviyo', { conversion_value: 300 }), rep('awin', { sale_amount: 200 })];
        expect(rawKpi('revenue', p, 'current', undefined).value).toBe(1000);
        expect(rawKpi('revenue', [rep('klaviyo', { conversion_value: 300 })], 'current', undefined).value).toBe(300);
    });
    it('lead reali: il dato inserito vince, altrimenti stima da Meta dichiarata come tale', () => {
        expect(rawKpi('leads_real', main, 'current', { leads_real: 18 })).toEqual({ value: 18, kind: 'real' });
        expect(rawKpi('leads_real', main, 'current', undefined)).toEqual({ value: 30, kind: 'proxy', proxyOf: 'Lead Meta' });
        expect(rawKpi('leads_real', [], 'current', undefined)).toEqual({ value: null, kind: null });
        // zero reale è zero, non «manca»
        expect(rawKpi('leads_real', main, 'current', { leads_real: 0 })).toEqual({ value: 0, kind: 'real' });
    });
    it('ordini: dato a mano se c\'è, altrimenti transazioni GA4', () => {
        expect(rawKpi('orders', main, 'current', { orders: 90 }).value).toBe(90);
        expect(rawKpi('orders', main, 'current', undefined).value).toBe(80);
    });
});

describe('kpi-compute: confronti', () => {
    it('percentuale con base sufficiente, colore secondo la direzione', () => {
        expect(compareDelta(120, 100, 'int', 'up')).toMatchObject({ kind: 'pct', value: 20, tone: 'good' });
        expect(compareDelta(80, 100, 'int', 'up')).toMatchObject({ tone: 'bad' });
        // un costo che sale è male
        expect(compareDelta(30, 20, 'eur', 'down')).toMatchObject({ kind: 'pct', value: 50, tone: 'bad' });
        expect(compareDelta(15, 20, 'eur', 'down')).toMatchObject({ tone: 'good' });
    });
    it('sotto il 10% è stabile', () => expect(compareDelta(105, 100, 'int', 'up')?.tone).toBe('neutral'));
    it('base piccola: differenza assoluta, e su numeri minuscoli niente giudizio', () => {
        expect(compareDelta(2, 3, 'int', 'up')).toMatchObject({ kind: 'abs', value: -1, tone: 'neutral', small: true });
        // da 3 a 40: la base è piccola ma il risultato non lo è
        expect(compareDelta(40, 3, 'int', 'up')).toMatchObject({ kind: 'abs', value: 37, tone: 'good', small: false });
    });
    it('da zero non esiste una percentuale', () => {
        expect(compareDelta(50, 0, 'eur', 'up')).toMatchObject({ kind: 'abs', value: 50 });
        expect(compareDelta(0, 0, 'eur', 'up')).toMatchObject({ kind: 'pct', value: 0, tone: 'neutral' });
    });
    it('la valutazione si confronta in punti', () => {
        expect(compareDelta(4.6, 4.4, 'rating', 'up')).toMatchObject({ kind: 'abs', value: 0.2, tone: 'good' });
        expect(compareDelta(4.62, 4.6, 'rating', 'up')?.tone).toBe('neutral');
    });
    it('manca un lato → nessun confronto', () => {
        expect(compareDelta(null, 5, 'int', 'up')).toBeNull();
        expect(compareDelta(5, null, 'int', 'up')).toBeNull();
    });
    it('formattazione italiana', () => {
        expect(formatValue(1234, 'int')).toBe('1.234');
        expect(formatValue(1234.4, 'eur')).toBe('1.234 €');
        expect(formatValue(20.5, 'eur')).toBe('20,50 €');
        expect(formatValue(8, 'ratio')).toBe('8,0x');
        expect(formatValue(1.6, 'pct')).toBe('1,6%');
        expect(formatValue(null, 'int')).toBe('—');
        expect(formatDelta({ kind: 'pct', value: 18.2, tone: 'good', small: false }, 'int')).toBe('+18%');
        expect(formatDelta({ kind: 'pct', value: -4.26, tone: 'neutral', small: false }, 'int')).toBe('−4,3%');
        expect(formatDelta(null, 'int')).toBe('—');
    });
});

describe('kpi-compute: un cliente, un mese', () => {
    const base = {
        clientId: 'c1', name: 'CITY MOTORS', profile: 'auto' as const, month: '2026-10',
        kpiIds: ['leads_real', 'cost_per_lead', 'gbp_calls', 'sessions', 'ads_spend'],
    };
    const main = [
        rep('facebook', { spend: 600, leads: 30 }, { spend: 500, leads: 25 }),
        rep('ga4', { sessions: 5000 }, { sessions: 4000 }),
        rep('gbp', { call_clicks: 40 }, { call_clicks: 50 }),
    ];

    it('dato reale presente in entrambi i mesi: si confronta, e il verdetto parte dal KPI principale', () => {
        const r = computeClientMonthly({ ...base, main, yoy: [], manual: { current: { leads_real: 20 }, previous: { leads_real: 10 } } });
        const k = r.kpis[0];
        expect(k).toMatchObject({ id: 'leads_real', value: 20, kind: 'real', previous: 10 });
        expect(k.vsPrev).toMatchObject({ kind: 'pct', value: 100, tone: 'good' });
        expect(r.verdict.state).toBe('up');
        expect(r.verdict.headline).toMatch(/In crescita: lead ricevuti 20, \+100% sul mese scorso/);
    });

    it('dato reale solo nel mese corrente: niente confronto con la stima del mese prima', () => {
        const r = computeClientMonthly({ ...base, main, yoy: [], manual: { current: { leads_real: 20 } } });
        expect(r.kpis[0]).toMatchObject({ value: 20, kind: 'real', previous: 25, vsPrev: null });
        // il verdetto passa al KPI successivo confrontabile (costo per lead, 20 → 20: stabile)
        expect(r.verdict.state).toBe('flat');
    });

    it('senza dato reale i lead sono una stima dichiarata, e un segnale lo dice', () => {
        const r = computeClientMonthly({ ...base, main, yoy: [], manual: {} });
        expect(r.kpis[0]).toMatchObject({ value: 30, kind: 'proxy', proxyOf: 'Lead Meta' });
        expect(r.alerts.some((a) => /Dato reale non inserito/.test(a))).toBe(true);
    });

    it('confronto con lo stesso mese dell\'anno scorso', () => {
        const yoy = [rep('ga4', { sessions: 2500 })];
        const r = computeClientMonthly({ ...base, kpiIds: ['sessions'], main, yoy, manual: {} });
        expect(r.kpis[0].yoy).toBe(2500);
        expect(r.kpis[0].vsYoy).toMatchObject({ kind: 'pct', value: 100, tone: 'good' });
    });

    it('cliente nuovo: nessun dato dell\'anno scorso → vsYoy null, non un errore', () => {
        const r = computeClientMonthly({ ...base, kpiIds: ['sessions'], main, yoy: [], manual: {} });
        expect(r.kpis[0].vsYoy).toBeNull();
        expect(r.kpis[0].vsPrev).not.toBeNull();
    });

    it('un KPI senza dato dice perché, e un dato reale mancante non è «nessun dato nel mese»', () => {
        const r = computeClientMonthly({ ...base, kpiIds: ['appointments', 'sessions'], main: [], yoy: [], manual: {} });
        expect(r.kpis[0]).toMatchObject({ value: null, missing: 'Dato non inserito' });
        expect(r.kpis[1]).toMatchObject({ value: null, missing: 'Nessun dato nel mese' });
    });

    it('tutto vuoto: dati insufficienti, mai una faccia inventata', () => {
        const r = computeClientMonthly({ ...base, main: [], yoy: [], manual: {} });
        expect(r.verdict.state).toBe('unknown');
        expect(r.verdict.headline).toMatch(/insufficienti/);
    });

    it('numeri troppo bassi: dati insufficienti', () => {
        const small = [rep('facebook', { spend: 50, leads: 2 }, { spend: 50, leads: 3 })];
        const r = computeClientMonthly({ ...base, kpiIds: ['leads_meta'], main: small, yoy: [], manual: {} });
        expect(r.verdict.state).toBe('unknown');
    });

    it('segnali: spesa senza lead, costi in forte aumento, fonti che non rispondono — al massimo tre', () => {
        const bad = [rep('facebook', { spend: 900, leads: 0 }, { spend: 400, leads: 20 }), rep('google_ads', { cost: 100 }, { cost: 100 })];
        const r = computeClientMonthly({ ...base, kpiIds: ['leads_meta', 'ads_spend', 'cost_per_lead'], main: bad, yoy: [], manual: {}, failedSources: ['Google Maps'] });
        expect(r.alerts.length).toBeLessThanOrEqual(3);
        expect(r.alerts[0]).toMatch(/Google Maps/);
        expect(r.alerts.some((a) => /senza lead meta/i.test(a))).toBe(true);
    });

    it('verdetto «in calo» quando il KPI principale scende oltre il 10%', () => {
        const down = [rep('ga4', { sessions: 3000 }, { sessions: 4000 })];
        const r = computeClientMonthly({ ...base, kpiIds: ['sessions'], main: down, yoy: [], manual: {} });
        expect(r.verdict.state).toBe('down');
        expect(verdictOf(r.kpis).headline).toMatch(/In calo: sessioni sito 3\.000, −25% sul mese scorso/);
    });
});

describe('kpi-compute: piattaforme necessarie', () => {
    it('legge solo ciò che serve ai KPI scelti', () => {
        const n = platformsNeeded(['gbp_calls', 'review_rating']);
        expect(Array.from(n)).toEqual(['gbp']);
        expect(platformsNeeded(['roas']).has('ga4')).toBe(true);
        expect(platformsNeeded(['roas']).has('google_ads')).toBe(true);
        expect(platformsNeeded(['roas']).has('facebook')).toBe(true);
        expect(platformsNeeded(['leads_real']).has('facebook')).toBe(true);
        expect(platformsNeeded(['appointments']).size).toBe(0);
        expect(platformsNeeded(['email_revenue']).has('klaviyo')).toBe(true);
    });
});
