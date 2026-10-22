import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getData, previousDay } from '../windsor-client';

const ok = (data: unknown[]) => ({ ok: true, json: async () => ({ data }) });

describe('previousDay', () => {
    it('giorno prima, anche a cavallo del mese', () => {
        expect(previousDay('2026-10-22')).toBe('2026-10-21');
        expect(previousDay('2026-11-01')).toBe('2026-10-31');
    });
    it('non una data → null', () => expect(previousDay('boh')).toBeNull());
});

describe('getData: finestra che finisce oggi e torna vuota', () => {
    const realFetch = global.fetch;
    const today = new Date().toISOString().slice(0, 10);
    beforeEach(() => { process.env.WINDSOR_API_KEY = 'k'; });
    afterEach(() => { global.fetch = realFetch; });

    it('riprova fino a ieri e restituisce le righe', async () => {
        const f = vi.fn().mockResolvedValueOnce(ok([])).mockResolvedValueOnce(ok([{ account_id: '1', page_fans: 5 }]));
        global.fetch = f as any;
        const rows = await getData({ connector: 'facebook_organic', accountId: '1', fields: ['page_fans', 'account_id'], dateFrom: '2000-01-01', dateTo: today });
        expect(rows).toHaveLength(1);
        expect(f).toHaveBeenCalledTimes(2);
        expect(String(f.mock.calls[1][0])).toContain(`date_to=${previousDay(today)}`);
    });
    it('non riprova se la fine era già nel passato', async () => {
        const f = vi.fn().mockResolvedValue(ok([]));
        global.fetch = f as any;
        const rows = await getData({ connector: 'facebook_organic', accountId: '1', fields: ['account_id'], dateFrom: '2000-01-01', dateTo: '2000-02-01' });
        expect(rows).toHaveLength(0);
        expect(f).toHaveBeenCalledTimes(1);
    });
    it('riprova una volta sola', async () => {
        const f = vi.fn().mockResolvedValue(ok([]));
        global.fetch = f as any;
        await getData({ connector: 'facebook_organic', accountId: '1', fields: ['account_id'], dateFrom: '2000-01-01', dateTo: today });
        expect(f).toHaveBeenCalledTimes(2);
    });
});
