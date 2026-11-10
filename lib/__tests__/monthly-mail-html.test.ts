import { describe, it, expect } from 'vitest';
import type { ClientMonthly, KpiResult } from '../kpi-compute';
import { GMAIL_CLIP_BYTES, buildMonthlyMail } from '../monthly-mail-html';

const kpi = (over: Partial<KpiResult> = {}): KpiResult => ({
    id: 'sessions', label: 'Sessioni sito', unit: 'int', better: 'up', value: 5000, kind: 'real', previous: 4000, yoy: 2500,
    vsPrev: { kind: 'pct', value: 25, tone: 'good', small: false }, vsYoy: { kind: 'pct', value: 100, tone: 'good', small: false }, ...over,
});

const client = (over: Partial<ClientMonthly> = {}): ClientMonthly => ({
    clientId: 'c1', name: 'CITY MOTORS', profile: 'auto', month: '2026-10',
    kpis: [kpi(), kpi({ id: 'gbp_calls', label: 'Chiamate da Google Maps', value: 40 }), kpi({ id: 'ads_spend', label: 'Spesa pubblicitaria', unit: 'eur', value: 1000 })],
    verdict: { state: 'up', headline: 'In crescita: sessioni sito 5.000, +25% sul mese scorso.' }, alerts: [], ...over,
});

const BASE = 'https://hub.wrdigital.it';

describe('monthly-mail-html', () => {
    it('oggetto con mese e numero di clienti in calo', () => {
        const m = buildMonthlyMail({ month: '2026-10', clients: [client(), client({ clientId: 'c2', name: 'B', verdict: { state: 'down', headline: 'In calo: x' } })], baseUrl: BASE });
        expect(m.subject).toBe('Report KPI clienti — ottobre 2026 (1 in calo)');
        expect(buildMonthlyMail({ month: '2026-10', clients: [client()], baseUrl: BASE }).subject).toBe('Report KPI clienti — ottobre 2026');
    });

    it('riepilogo: conta i clienti per stato', () => {
        const m = buildMonthlyMail({
            month: '2026-10', baseUrl: BASE,
            clients: [client(), client({ clientId: 'b', verdict: { state: 'flat', headline: '' } }), client({ clientId: 'c', verdict: { state: 'down', headline: '' } }),
                client({ clientId: 'd', verdict: { state: 'unknown', headline: 'Dati insufficienti: nessun dato.' } })],
        });
        expect(m.counts).toEqual({ down: 1, flat: 1, up: 1, unknown: 1 });
    });

    it('chi è in calo o ha un segnale compare per primo con la tabella; gli altri in una riga', () => {
        const m = buildMonthlyMail({
            month: '2026-10', baseUrl: BASE,
            clients: [
                client({ clientId: 'ok', name: 'CLIENTE OK' }),
                client({ clientId: 'down', name: 'CLIENTE IN CALO', verdict: { state: 'down', headline: 'In calo: x' } }),
                client({ clientId: 'alert', name: 'CLIENTE CON SEGNALE', alerts: ['Spesa di 900 € senza lead.'] }),
            ],
        });
        const { html } = m;
        expect(html.indexOf('Da guardare per primi')).toBeGreaterThan(-1);
        expect(html.indexOf('CLIENTE IN CALO')).toBeLessThan(html.indexOf('CLIENTE CON SEGNALE'));
        expect(html.indexOf('CLIENTE CON SEGNALE')).toBeLessThan(html.indexOf('CLIENTE OK'));
        expect(html).toContain('vs mese scorso');
        expect(html).toContain('Spesa di 900 € senza lead.');
        // il cliente in ordine non ha la tabella: l'intestazione compare solo per i due da guardare
        expect(html.split('vs mese scorso').length - 1).toBe(2);
    });

    it('chi non ha dati sufficienti sta in fondo, senza tabella e senza faccia inventata', () => {
        const m = buildMonthlyMail({ month: '2026-10', baseUrl: BASE, clients: [client({ clientId: 'u', name: 'SENZA DATI', verdict: { state: 'unknown', headline: 'Dati insufficienti: nessun KPI ha un valore nel mese.' }, kpis: [] })] });
        expect(m.html).toContain('Dati insufficienti');
        expect(m.html).toContain('SENZA DATI');
        expect(m.html).not.toContain('Da guardare per primi');
    });

    it('una stima da Meta è marcata con l\'asterisco e spiegata in fondo', () => {
        const m = buildMonthlyMail({ month: '2026-10', baseUrl: BASE, clients: [client({ kpis: [kpi({ id: 'leads_real', label: 'Lead ricevuti', kind: 'proxy', proxyOf: 'Lead Meta', value: 30 })] })] });
        expect(m.html).toContain('<sup');
        expect(m.html).toContain('stima da Meta');
        expect(buildMonthlyMail({ month: '2026-10', baseUrl: BASE, clients: [client()] }).html).not.toContain('stima da Meta');
    });

    it('un KPI senza valore dice perché invece di scrivere 0', () => {
        const m = buildMonthlyMail({ month: '2026-10', baseUrl: BASE, clients: [client({ verdict: { state: 'down', headline: 'x' }, kpis: [kpi({ id: 'appointments', label: 'Appuntamenti', value: null, kind: null, vsPrev: null, vsYoy: null, missing: 'Dato non inserito' })] })] });
        expect(m.html).toContain('Dato non inserito');
    });

    it('i nomi e i testi si ripuliscono: nessun HTML iniettato dai dati', () => {
        const m = buildMonthlyMail({ month: '2026-10', baseUrl: BASE, clients: [client({ name: '<script>alert(1)</script> & Figli', verdict: { state: 'down', headline: '"><img src=x onerror=1>' }, alerts: ['<b>x</b>'] })] });
        expect(m.html).not.toContain('<script>');
        expect(m.html).not.toContain('<img');
        expect(m.html).not.toContain('<b>x</b>');
        expect(m.html).toContain('&lt;script&gt;');
        expect(m.html).toContain('&amp; Figli');
    });

    it('link al cliente nel Hub, con l\'id codificato', () => {
        const m = buildMonthlyMail({ month: '2026-10', baseUrl: 'https://hub.wrdigital.it/', clients: [client({ clientId: 'a/b c' })] });
        expect(m.html).toContain('https://hub.wrdigital.it/clients/a%2Fb%20c');
    });

    it('mese di confronto nell\'intestazione, anche a cavallo d\'anno', () => {
        const m = buildMonthlyMail({ month: '2026-01', baseUrl: BASE, clients: [client()] });
        expect(m.html).toContain('gennaio 2026 · confronto con dicembre 2025 e gennaio 2025');
    });

    it('versione testo con i clienti da guardare', () => {
        const m = buildMonthlyMail({ month: '2026-10', baseUrl: BASE, clients: [client({ name: 'IN CALO', verdict: { state: 'down', headline: 'In calo: x' }, alerts: ['segnale uno'] })] });
        expect(m.text).toContain('DA GUARDARE PER PRIMI');
        expect(m.text).toContain('- IN CALO: In calo: x');
        expect(m.text).toContain('segnale uno');
    });

    it('anche con 47 clienti tutti da guardare (caso peggiore) resta sotto il limite di Gmail', () => {
        const clients = Array.from({ length: 47 }, (_, i) => client({
            clientId: `id${i}`, name: `CLIENTE NUMERO ${i + 1} S.R.L.`, verdict: { state: 'down', headline: 'In calo: sessioni sito 3.000, −25% sul mese scorso.' },
            kpis: Array.from({ length: 5 }, (_, k) => kpi({ id: `k${k}`, label: `Indicatore numero ${k + 1}` })),
            alerts: ['Fonti che non hanno risposto: Google Maps.', 'Dato reale non inserito: lead ricevuti stimati con Lead Meta.'],
        }));
        const m = buildMonthlyMail({ month: '2026-10', clients, baseUrl: BASE });
        expect(m.bytes).toBeLessThan(GMAIL_CLIP_BYTES);
        // riducendo non si perde nessun cliente né i suoi segnali, e la mail dice che ha ridotto
        expect(m.html).toContain('in forma ridotta');
        for (const c of clients) expect(m.html).toContain(c.name);
        expect(m.html.split('Fonti che non hanno risposto: Google Maps.').length - 1).toBe(47);
        // i più urgenti (primi della lista) hanno ancora la tabella
        expect(m.html).toContain('vs mese scorso');
    });

    it('con pochi clienti non riduce nulla', () => {
        const m = buildMonthlyMail({ month: '2026-10', baseUrl: BASE, clients: [client({ verdict: { state: 'down', headline: 'x' } })] });
        expect(m.html).not.toContain('in forma ridotta');
    });
});
