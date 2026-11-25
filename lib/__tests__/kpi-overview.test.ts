import { describe, it, expect } from 'vitest';
import { buildProfileOverview, cellText, deltaText, overviewToCsv, type SnapshotMap } from '../kpi-overview';
import type { ClientMonthly, KpiResult } from '../kpi-compute';

const kpi = (id: string, over: Partial<KpiResult> = {}): KpiResult => ({
    id, label: `KPI ${id}`, unit: 'int', better: 'up', value: 10, kind: 'real', previous: 8, yoy: null,
    vsPrev: { kind: 'pct', value: 25, tone: 'good', small: false }, vsYoy: null, ...over,
});

const snap = (clientId: string, kpis: KpiResult[], extra: Partial<ClientMonthly> = {}) => ({
    computedAt: '2026-11-03T08:00:00.000Z',
    result: { clientId, name: clientId, profile: 'auto', month: '2026-10', kpis, verdict: 'ok', alerts: [], ...extra } as unknown as ClientMonthly,
});

describe('buildProfileOverview', () => {
    const clients = [{ id: 'b', name: 'Beta Auto' }, { id: 'a', name: 'alfa motori' }, { id: 'c', name: 'Cesare' }];
    const snapshots: SnapshotMap = {
        a: snap('a', [kpi('ads_spend', { unit: 'eur' }), kpi('leads_real')]),
        b: snap('b', [kpi('leads_real'), kpi('sessions')]),
    };

    it('un cliente senza fotografia compare lo stesso, segnato come tale', () => {
        const o = buildProfileOverview({ profile: 'auto', month: '2026-10', clients, snapshots });
        expect(o.total).toBe(3);
        expect(o.withData).toBe(2);
        const c = o.rows.find((r) => r.clientId === 'c')!;
        expect(c.hasSnapshot).toBe(false);
        expect(c.computedAt).toBeNull();
    });
    it('dice se il cliente entra nella mail mensile (da lì si calcolano i numeri); se non si sa, null', () => {
        const o = buildProfileOverview({
            profile: 'auto', month: '2026-10',
            clients: [{ id: 'x', name: 'X', inMail: true }, { id: 'y', name: 'Y', inMail: false }, { id: 'z', name: 'Z' }],
            snapshots: {},
        });
        expect(o.rows.map((r) => r.inMail)).toEqual([true, false, null]);
        const csv = overviewToCsv({ ...o, columns: [{ id: 'k', label: 'K', unit: 'int' }] }).split('\r\n');
        expect(csv.find((r) => r.includes(';X;'))).toContain('da calcolare');
        expect(csv.find((r) => r.includes(';Y;'))).toContain('non nella mail mensile');
        expect(csv.find((r) => r.includes(';Z;'))).toContain('da calcolare');
    });
    it('i clienti vanno in ordine alfabetico, senza badare alle maiuscole', () => {
        const o = buildProfileOverview({ profile: 'auto', month: '2026-10', clients, snapshots });
        expect(o.rows.map((r) => r.name)).toEqual(['alfa motori', 'Beta Auto', 'Cesare']);
    });
    it('le colonne sono l\'unione dei KPI, prima quelli di default del profilo nel loro ordine', () => {
        const o = buildProfileOverview({ profile: 'auto', month: '2026-10', clients, snapshots });
        const ids = o.columns.map((c) => c.id);
        // default «auto»: leads_real, cost_per_lead, gbp_calls, sessions, ads_spend
        expect(ids).toEqual(['leads_real', 'sessions', 'ads_spend']);
    });
    it('un KPI scelto a mano per un solo cliente compare in fondo', () => {
        const s: SnapshotMap = { a: snap('a', [kpi('leads_real'), kpi('followers')]) };
        const o = buildProfileOverview({ profile: 'auto', month: '2026-10', clients: [{ id: 'a', name: 'A' }], snapshots: s });
        expect(o.columns.map((c) => c.id)).toEqual(['leads_real', 'followers']);
    });
    it('senza nessuna fotografia: nessuna colonna, tutti «da calcolare»', () => {
        const o = buildProfileOverview({ profile: 'social', month: '2026-10', clients, snapshots: {} });
        expect(o.columns).toEqual([]);
        expect(o.withData).toBe(0);
        expect(o.rows.every((r) => !r.hasSnapshot)).toBe(true);
    });
    it('un mese in corso porta i giorni letti', () => {
        const s: SnapshotMap = { a: snap('a', [kpi('leads_real')], { partial: { days: 12 } }) };
        const o = buildProfileOverview({ profile: 'auto', month: '2026-11', clients: [{ id: 'a', name: 'A' }], snapshots: s });
        expect(o.rows[0].partialDays).toBe(12);
    });
});

describe('cellText e deltaText', () => {
    it('numero formattato, «~» se è una stima, «—» se manca', () => {
        expect(cellText(kpi('x', { value: 1234 }))).toBe('1.234');
        expect(cellText(kpi('x', { value: 1234, kind: 'proxy' }))).toBe('~1.234');
        expect(cellText(kpi('x', { value: null, kind: null }))).toBe('—');
        expect(cellText(undefined)).toBe('—');
    });
    it('la variazione sul mese prima', () => {
        expect(deltaText(kpi('x'))).toBe('+25%');
        expect(deltaText(kpi('x', { vsPrev: null }))).toBe('—');
        expect(deltaText(undefined)).toBe('—');
    });
});

describe('overviewToCsv', () => {
    const o = buildProfileOverview({
        profile: 'auto', month: '2026-10',
        clients: [{ id: 'a', name: 'Alfa; Motori' }, { id: 'c', name: '=Formula' }],
        snapshots: { a: snap('a', [kpi('leads_real', { value: 40 })]) },
    });
    const csv = overviewToCsv(o);
    const rows = csv.trim().split('\r\n');
    it('intestazione con due colonne per KPI e una riga per cliente', () => {
        expect(rows[0]).toBe('Mese;Profilo;Cliente;KPI leads_real;KPI leads_real (var. mese prima)');
        expect(rows).toHaveLength(3);
    });
    it('un nome con il punto e virgola va tra virgolette; il valore e la variazione ci sono', () => {
        expect(rows.find((r) => r.includes('Alfa'))).toBe('2026-10;Auto e moto;"Alfa; Motori";40;+25%');
    });
    it('un nome che sembra una formula si neutralizza; chi non ha dati dice «da calcolare»', () => {
        expect(rows.find((r) => r.includes('Formula'))).toBe("2026-10;Auto e moto;'=Formula;da calcolare;");
    });
});
