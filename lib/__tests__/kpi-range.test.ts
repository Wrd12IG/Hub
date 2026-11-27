import { describe, it, expect, vi } from 'vitest';

// kpi-monthly importa Firestore e le piattaforme: qui si provano solo i controlli sull'intervallo, che vengono prima di ogni lettura
vi.mock('../firebase-admin', () => ({ adminDb: { collection: () => { throw new Error('Firestore non deve essere toccato'); } } }));
vi.mock('../api-auth', () => ({ getClientToken: async () => null }));
vi.mock('../reporting', () => ({ getClientMarketingReport: async () => [] }));
vi.mock('../kpi-profiles-store', () => ({ readKpiOverrides: async () => ({}) }));
vi.mock('../monthly-mail-store', () => ({ readManualKpis: async () => ({}), writeSnapshot: async () => undefined }));

import { SHEET_RANGE_NOTE, computeClientRange, wholeMonthsOf } from '../kpi-monthly';

describe('wholeMonthsOf', () => {
    it('riconosce i mesi interi, anche più di uno e a cavallo d\'anno', () => {
        expect(wholeMonthsOf('2026-10-01', '2026-10-31')).toEqual(['2026-10']);
        expect(wholeMonthsOf('2026-11-01', '2027-01-31')).toEqual(['2026-11', '2026-12', '2027-01']);
        expect(wholeMonthsOf('2024-02-01', '2024-02-29')).toEqual(['2024-02']);
    });
    it('un intervallo di giorni qualsiasi non è fatto di mesi interi', () => {
        expect(wholeMonthsOf('2026-10-02', '2026-10-31')).toBeNull();
        expect(wholeMonthsOf('2026-10-01', '2026-10-30')).toBeNull();
        expect(wholeMonthsOf('2026-11-10', '2026-11-20')).toBeNull();
    });
});

describe('computeClientRange: controlli sulle date', () => {
    it('rifiuta date non valide, inizio dopo la fine e più di un anno', async () => {
        expect(await computeClientRange('c', '2026-13-01', '2026-11-10')).toMatchObject({ ok: false, reason: 'bad_range' });
        expect(await computeClientRange('c', '2026-02-30', '2026-03-01')).toMatchObject({ ok: false, reason: 'bad_range' });
        expect(await computeClientRange('c', '2026-11-10', '2026-11-01')).toMatchObject({ ok: false, reason: 'bad_range' });
        expect(await computeClientRange('c', '2024-01-01', '2025-01-01')).toMatchObject({ ok: false, reason: 'bad_range' });
    });
    it('un intervallo tutto nel futuro non ha giorni chiusi', async () => {
        const out = await computeClientRange('c', '2999-01-01', '2999-01-10');
        expect(out).toMatchObject({ ok: false, reason: 'bad_range' });
        if (!out.ok) expect(out.message).toMatch(/ieri/);
    });
    it('la nota per i KPI dello Sheet spiega che servono mesi interi', () => {
        expect(SHEET_RANGE_NOTE).toMatch(/mesi interi/);
    });
});
