import { describe, it, expect } from 'vitest';
import type { ClientMonthly, KpiResult } from '../kpi-compute';
import type { WeekResult } from '../kpi-weekly';
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

const weeks = (over: Partial<WeekResult>[] = []): WeekResult[] => [[1, 7], [8, 14], [15, 21], [22, 28], [29, 31]].map(([a, b], i) => ({
    n: i + 1, dateFrom: `2026-10-${String(a).padStart(2, '0')}`, dateTo: `2026-10-${String(b).padStart(2, '0')}`, days: b - a + 1, comparable: i < 4,
    kpis: ['sessions', 'gbp_calls', 'cost_per_lead'].map((id, k) => ({ id, value: 1000 + k * 10 + i, previous: 900, kind: 'real' as const, vsPrev: i < 4 ? { kind: 'pct' as const, value: 11 + i, tone: (i % 2 ? 'bad' : 'good') as 'good' | 'bad', small: false } : null })),
    verdict: (['up', 'down', 'flat', 'up', 'unknown'] as const)[i], ...(over[i] ?? {}),
}));

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

    it('settimana su settimana: i clienti da guardare hanno la tabella, gli altri la riga con le frecce', () => {
        const m = buildMonthlyMail({
            month: '2026-10', baseUrl: BASE,
            clients: [
                client({ clientId: 'd', name: 'IN CALO', verdict: { state: 'down', headline: 'In calo: x' }, weeks: weeks() }),
                client({ clientId: 'k', name: 'IN ORDINE', weeks: weeks() }),
            ],
        });
        // tabella (solo per il cliente in calo): giorni delle settimane, valori e variazioni
        expect(m.html.split('Settimana su settimana').length - 1).toBe(1);
        expect(m.html).toContain('1&ndash;7');
        expect(m.html).toContain('29&ndash;31');
        expect(m.html).toContain('+11%');
        expect(m.html).toContain('Sessioni sito');
        // riga con le frecce per il cliente in ordine (e anche sotto quello in calo se ridotto: qui è espanso, quindi una sola)
        expect(m.html.split('Settimane: ').length - 1).toBe(1);
        expect(m.html).toContain('&#9650;'); // su
        expect(m.html).toContain('&#9660;'); // giù
        expect(m.html).toContain('stessa del mese prima');
    });

    it('settimana non disponibile: n/d, mai uno zero', () => {
        const w = weeks([{}, { unavailable: true, kpis: [], verdict: 'unknown' }]);
        const m = buildMonthlyMail({ month: '2026-10', baseUrl: BASE, clients: [client({ verdict: { state: 'down', headline: 'x' }, weeks: w })] });
        expect(m.html).toContain('n/d');
    });

    it('una fotografia vecchia, senza settimane, si legge ancora e non mostra sezioni vuote', () => {
        const m = buildMonthlyMail({ month: '2026-10', baseUrl: BASE, clients: [client({ verdict: { state: 'down', headline: 'x' } }), client({ clientId: 'b', name: 'B' })] });
        expect(m.html).not.toContain('Settimana su settimana');
        expect(m.html).not.toContain('Settimane: ');
    });

    it('testo: le settimane dei clienti da guardare', () => {
        const m = buildMonthlyMail({ month: '2026-10', baseUrl: BASE, clients: [client({ name: 'IN CALO', verdict: { state: 'down', headline: 'x' }, weeks: weeks() })] });
        expect(m.text).toContain('settimane: 1-7 su · 8-14 giù · 15-21 = · 22-28 su · 29-31 n.d.');
    });

    it('47 clienti da guardare CON le settimane: resta sotto il limite di Gmail e non perde nessuno', () => {
        const clients = Array.from({ length: 47 }, (_, i) => client({
            clientId: `id${i}`, name: `CLIENTE NUMERO ${i + 1} S.R.L.`, verdict: { state: 'down', headline: 'In calo: sessioni sito 3.000, −25% sul mese scorso.' },
            kpis: Array.from({ length: 5 }, (_, k) => kpi({ id: `k${k}`, label: `Indicatore numero ${k + 1}` })),
            alerts: ['Fonti che non hanno risposto: Google Maps.'], weeks: weeks(),
        }));
        const m = buildMonthlyMail({ month: '2026-10', clients, baseUrl: BASE });
        expect(m.bytes).toBeLessThan(GMAIL_CLIP_BYTES);
        for (const c of clients) expect(m.html).toContain(c.name);
        // anche ridotti, i clienti hanno la riga con le settimane
        expect(m.html.split('Settimane: ').length - 1 + m.html.split('Settimana su settimana').length - 1).toBeGreaterThanOrEqual(47);
    });

    it('con pochi clienti non riduce nulla', () => {
        const m = buildMonthlyMail({ month: '2026-10', baseUrl: BASE, clients: [client({ verdict: { state: 'down', headline: 'x' } })] });
        expect(m.html).not.toContain('in forma ridotta');
    });
});

describe('monthly-mail-html: marca e provenienza dei concessionari', () => {
    it('mostra la tabella solo per chi ha il dettaglio dello Sheet, con i soli tipi presenti', async () => {
        const { buildMonthlyMail } = await import('../monthly-mail-html');
        const base = {
            profile: 'auto' as const, month: '2026-10', verdict: { state: 'down' as const, headline: 'In calo' }, alerts: ['x'],
            kpis: [{ id: 'leads_real', label: 'Lead ricevuti', unit: 'int' as const, better: 'up' as const, value: 5, kind: 'real' as const, previous: 9, yoy: null, vsPrev: { kind: 'abs' as const, value: -4, tone: 'neutral' as const, small: true }, vsYoy: null }],
        };
        const withDealer = { ...base, clientId: 'a', name: 'Centro CarCazzaro', dealer: { byBrand: { lead: { Renault: 3, Dacia: 2 } }, bySource: { lead: { Google: 4, Meta: 1 } } } };
        const without = { ...base, clientId: 'b', name: 'Altro' };
        const mail = buildMonthlyMail({ month: '2026-10', clients: [withDealer, without], baseUrl: 'https://hub.test' });
        expect(mail.html).toContain('Marca e provenienza');
        expect(mail.html).toContain('Renault <b style="color:#111827;">3</b>');
        expect(mail.html).toContain('Google <b style="color:#111827;">4</b>');
        expect(mail.html).not.toContain('Appuntamento');
        expect(mail.text).toContain('    Lead: Renault 3 · Dacia 2 | Google 4 · Meta 1');
        expect((mail.html.match(/Marca e provenienza/g) ?? []).length).toBe(1);
    });
});
