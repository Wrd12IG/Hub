// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { memoryDealerStore, syncClient } from '@/lib/dealer-kpi/sync';
import { mapError, SheetsError, type SheetsReader } from '@/lib/dealer-kpi/sheets';

const NOW = new Date('2026-11-24T04:30:00Z');
const CFG = { spreadsheetId: '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd', tab: 'Dati' };
const H = ['Mese', 'Tipo', 'Marca', 'Provenienza', 'Quantità'];
const reader = (rows: string[][]): SheetsReader => async () => rows;

describe('sincronizzazione dello Sheet', () => {
    it('legge, salva i mesi e lo stato; nessun problema = ok', async () => {
        const store = memoryDealerStore(CFG);
        const s = await syncClient('c1', { store, reader: reader([H, ['2026-11', 'Lead', 'Fiat', 'Google', '10'], ['2026-10', 'Vendita', 'Fiat', 'Showroom', '2']]), now: NOW });
        expect(s).toMatchObject({ lastStatus: 'ok', months: ['2026-10', '2026-11'], rowsRead: 2, issuesTotal: 0 });
        expect(Array.from(store.months.keys()).sort()).toEqual(['2026-10', '2026-11']);
        expect(store.months.get('2026-11')?.totals.byType.lead).toBe(10);
        expect(store.status()?.lastSyncAt).toBe(NOW.toISOString());
    });
    it('righe sbagliate: salvato il resto, stato «avvisi» con i problemi per riga', async () => {
        const store = memoryDealerStore(CFG);
        const s = await syncClient('c1', { store, reader: reader([H, ['2026-11', 'Lead', 'Fiat', 'Google', '10'], ['2026-11', 'Lead', 'Fiat', 'Google', 'tanti'], ['2026-11', 'Lead', 'Fiat', 'Porta', '1']]), now: NOW });
        expect(s.lastStatus).toBe('avvisi');
        expect(s.issues.map((i) => [i.row, i.level])).toEqual([[3, 'errore'], [4, 'avviso']]);
        expect(s.lastMessage).toMatch(/1 riga saltata, 1 avvisi/);
        expect(store.months.get('2026-11')?.totals.byType.lead).toBe(11);
    });
    it('un mese tolto dallo Sheet sparisce anche dalla hub (lo Sheet è la fonte)', async () => {
        const store = memoryDealerStore(CFG);
        await syncClient('c1', { store, reader: reader([H, ['2026-10', 'Lead', 'Fiat', 'Google', '1'], ['2026-11', 'Lead', 'Fiat', 'Google', '2']]), now: NOW });
        await syncClient('c1', { store, reader: reader([H, ['2026-11', 'Lead', 'Fiat', 'Google', '2']]), now: NOW });
        expect(Array.from(store.months.keys())).toEqual(['2026-11']);
    });
    it('lettura fallita o intestazione sbagliata: errore chiaro e dati precedenti INTATTI', async () => {
        const store = memoryDealerStore(CFG);
        await syncClient('c1', { store, reader: reader([H, ['2026-11', 'Lead', 'Fiat', 'Google', '2']]), now: NOW });
        const down = await syncClient('c1', { store, reader: async () => { throw new SheetsError('non_condiviso', 'Lo Sheet non è condiviso'); }, now: NOW });
        expect(down).toMatchObject({ lastStatus: 'errore', lastMessage: 'Lo Sheet non è condiviso', months: ['2026-11'] });
        expect(store.months.size).toBe(1);
        const broken = await syncClient('c1', { store, reader: reader([['Foo', 'Bar']]), now: NOW });
        expect(broken.lastStatus).toBe('errore');
        expect(store.months.size).toBe(1);
    });
    it('senza Sheet collegato non legge niente', async () => {
        const read = vi.fn();
        const s = await syncClient('c1', { store: memoryDealerStore(null), reader: read, now: NOW });
        expect(s.lastStatus).toBe('errore');
        expect(read).not.toHaveBeenCalled();
    });
});

describe('errori di Google tradotti', () => {
    const email = 'hub@progetto.iam.gserviceaccount.com';
    it('non condiviso: dice con chi condividerlo', () => {
        const e = mapError({ status: 403, message: 'The caller does not have permission' }, email, 'Dati');
        expect(e.code).toBe('non_condiviso');
        expect(e.message).toContain(email);
    });
    it('API disattivata, non trovato, scheda mancante, quota', () => {
        expect(mapError({ status: 403, message: 'Google Sheets API has not been used in project 123 before or it is disabled' }, email, 'Dati').code).toBe('api_disattivata');
        expect(mapError({ status: 404, message: 'Requested entity was not found' }, email, 'Dati').code).toBe('non_trovato');
        const tab = mapError({ status: 400, message: 'Unable to parse range: Dati!A:F' }, email, 'Dati');
        expect(tab.code).toBe('scheda');
        expect(tab.message).toContain('Dati');
        expect(mapError({ status: 429, message: 'quota' }, email, 'Dati').code).toBe('quota');
    });
});
