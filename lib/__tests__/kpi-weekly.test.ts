import { describe, it, expect } from 'vitest';
import type { PlatformReport } from '../reporting';
import { completedBlocks, computeWeeks, monthWindows, weekBlocks, weekComparison, weeklyKpiIds, type WeekBlock } from '../kpi-weekly';

const rep = (platform: PlatformReport['platform'], rows: Record<string, number>, previousRows: Record<string, number> = {}): PlatformReport =>
    ({ platform, connected: true, rows: [rows], previousRows: Object.keys(previousRows).length ? [previousRows] : [] });

describe('weekBlocks', () => {
    it('mese da 31 giorni: 4 blocchi da 7 e un quinto da 3', () => {
        const b = weekBlocks('2026-10');
        expect(b.map((x) => [x.dateFrom, x.dateTo, x.days])).toEqual([
            ['2026-10-01', '2026-10-07', 7], ['2026-10-08', '2026-10-14', 7], ['2026-10-15', '2026-10-21', 7],
            ['2026-10-22', '2026-10-28', 7], ['2026-10-29', '2026-10-31', 3],
        ]);
    });
    it('mese da 30 giorni: il quinto è di 2 giorni', () => expect(weekBlocks('2026-11')[4]).toMatchObject({ n: 5, dateFrom: '2026-11-29', dateTo: '2026-11-30', days: 2 }));
    it('febbraio non bisestile: 4 blocchi esatti, nessun quinto', () => {
        expect(weekBlocks('2026-02')).toHaveLength(4);
        expect(weekBlocks('2028-02')).toHaveLength(5); // bisestile: il 29
        expect(weekBlocks('2028-02')[4].days).toBe(1);
    });
});

describe('weekComparison', () => {
    it('la settimana N del mese prima, se lunga uguale', () => {
        expect(weekComparison('2026-11', 2)).toMatchObject({ dateFrom: '2026-10-08', dateTo: '2026-10-14' });
    });
    it('la quinta non si confronta se le lunghezze sono diverse (2 giorni contro 3)', () => {
        expect(weekComparison('2026-11', 5)).toBeNull(); // nov 29-30 (2) vs ott 29-31 (3)
        expect(weekComparison('2026-12', 5)).toBeNull(); // dic 29-31 (3) vs nov 29-30 (2)
    });
    it('la quinta si confronta se il mese prima ha la stessa lunghezza', () => {
        expect(weekComparison('2026-08', 5)).toMatchObject({ dateFrom: '2026-07-29', dateTo: '2026-07-31' }); // 3 vs 3
    });
    it('se il mese prima non ha la quinta, nessun confronto', () => expect(weekComparison('2026-03', 5)).toBeNull()); // feb 2026 ha 28 giorni
});

describe('completedBlocks', () => {
    it('un mese chiuso: tutte le settimane', () => expect(completedBlocks('2026-10', '2026-11-03')).toHaveLength(5));
    it('a metà mese: solo le settimane già finite (la corrente non si giudica)', () => {
        expect(completedBlocks('2026-11', '2026-11-16').map((b) => b.n)).toEqual([1, 2]); // la 3ª (15-21) è in corso
        expect(completedBlocks('2026-11', '2026-11-22').map((b) => b.n)).toEqual([1, 2, 3]);
        expect(completedBlocks('2026-11', '2026-11-07')).toEqual([]);
    });
});

describe('monthWindows', () => {
    it('mese chiuso: mese intero, mese prima intero, anno scorso intero', () => {
        const w = monthWindows('2026-10', '2026-11-03')!;
        expect(w).toMatchObject({ partial: false, days: 31, current: { dateFrom: '2026-10-01', dateTo: '2026-10-31' }, previous: { dateFrom: '2026-09-01', dateTo: '2026-09-30' }, yoy: { dateFrom: '2025-10-01', dateTo: '2025-10-31' } });
    });
    it('mese in corso: dal 1° a ieri contro gli stessi giorni', () => {
        const w = monthWindows('2026-11', '2026-11-16')!;
        expect(w).toMatchObject({ partial: true, days: 15, current: { dateFrom: '2026-11-01', dateTo: '2026-11-15' }, previous: { dateFrom: '2026-10-01', dateTo: '2026-10-15' }, yoy: { dateFrom: '2025-11-01', dateTo: '2025-11-15' } });
    });
    it('primo del mese o mese futuro: niente da confrontare', () => {
        expect(monthWindows('2026-11', '2026-11-01')).toBeNull();
        expect(monthWindows('2026-12', '2026-11-16')).toBeNull();
    });
    it('il confronto non esce dal mese prima se è più corto', () => {
        const w = monthWindows('2026-03', '2026-03-31')!; // 30 giorni chiusi, febbraio ne ha 28
        expect(w.previous).toEqual({ dateFrom: '2026-02-01', dateTo: '2026-02-28' });
    });
});

describe('computeWeeks', () => {
    const block = (n: number): WeekBlock => ({ n, dateFrom: `2026-10-${String(1 + (n - 1) * 7).padStart(2, '0')}`, dateTo: `2026-10-${String(7 + (n - 1) * 7).padStart(2, '0')}`, days: 7 });
    const kpiIds = ['leads_real', 'cost_per_lead', 'sessions', 'appointments'];

    it('i KPI solo mensili (appuntamenti) non entrano nelle settimane; i lead sì, con il ripiego Meta', () => {
        expect(weeklyKpiIds(kpiIds)).toEqual(['leads_real', 'cost_per_lead', 'sessions']);
        expect(weeklyKpiIds(['appointments', 'test_drives', 'sales'])).toEqual([]);
    });

    it('valore, settimana prima e variazione; i lead ripiegano sulla stima Meta e lo dicono', () => {
        const reports = [rep('facebook', { spend: 700, leads: 35 }, { spend: 500, leads: 25 }), rep('ga4', { sessions: 1200 }, { sessions: 1000 })];
        const [w] = computeWeeks(kpiIds, [{ block: block(1), comparable: true, reports }]);
        const leads = w.kpis.find((k) => k.id === 'leads_real')!;
        expect(leads).toMatchObject({ value: 35, previous: 25, kind: 'proxy' });
        expect(leads.vsPrev).toMatchObject({ kind: 'pct', value: 40, tone: 'good' });
        expect(w.kpis.find((k) => k.id === 'cost_per_lead')!.vsPrev).toMatchObject({ value: 0, tone: 'neutral' }); // 20 € contro 20 €
        expect(w.kpis.find((k) => k.id === 'sessions')!.vsPrev).toMatchObject({ kind: 'pct', value: 20, tone: 'good' });
        expect(w.kpis.some((k) => k.id === 'appointments')).toBe(false);
        expect(w.comparable).toBe(true);
        expect(w.verdict).toBe('up');
    });

    it('settimana non confrontabile: i valori ci sono, le variazioni no, verdetto «dati insufficienti»', () => {
        const [w] = computeWeeks(['sessions'], [{ block: block(5), comparable: false, reports: [rep('ga4', { sessions: 300 })] }]);
        expect(w.kpis[0]).toMatchObject({ value: 300, previous: null, vsPrev: null });
        expect(w.verdict).toBe('unknown');
    });

    it('lettura fallita: «non disponibile», nessun numero inventato', () => {
        const [w] = computeWeeks(['sessions'], [{ block: block(2), comparable: true, reports: null }]);
        expect(w).toMatchObject({ unavailable: true, kpis: [], verdict: 'unknown' });
    });

    it('numeri troppo piccoli: niente percentuale e verdetto «dati insufficienti» (da 3 a 2 lead non è −33%)', () => {
        const [w] = computeWeeks(['leads_meta'], [{ block: block(1), comparable: true, reports: [rep('facebook', { leads: 2 }, { leads: 3 })] }]);
        expect(w.kpis[0].vsPrev).toMatchObject({ kind: 'abs', small: true });
        expect(w.verdict).toBe('unknown');
    });
});
