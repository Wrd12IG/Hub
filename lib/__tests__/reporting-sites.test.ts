import { describe, it, expect, vi, beforeEach } from 'vitest';

const ga4 = vi.hoisted(() => ({ totals: vi.fn(), daily: vi.fn() }));
const sc = vi.hoisted(() => ({ totals: vi.fn(), daily: vi.fn() }));

vi.mock('../ga4-client', () => ({ getGA4Totals: ga4.totals, getGA4Daily: ga4.daily, getGA4Overview: vi.fn() }));
vi.mock('../search-console-client', () => ({ getSearchConsoleTotals: sc.totals, getSearchConsoleDaily: sc.daily }));

import { getClientMarketingReport } from '../reporting';

const windows = {
    current: { dateFrom: '2026-10-01', dateTo: '2026-10-31' },
    previous: { dateFrom: '2026-09-01', dateTo: '2026-09-30' },
};

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Ogni proprietà risponde con i suoi numeri, così si vede da dove arriva ciascuna voce
    ga4.totals.mockImplementation(async (propertyId: string) => ({ sessions: propertyId === '111111' ? 3000 : 2000 }));
    ga4.daily.mockResolvedValue([]);
    sc.totals.mockImplementation(async (siteUrl: string) => ({ clicks: siteUrl.includes('renault') ? 700 : 300 }));
    sc.daily.mockResolvedValue([]);
});

describe('getClientMarketingReport con più siti', () => {
    const sites = [
        { id: 'a', url: 'https://www.renault.it', brand: 'Renault', ga4PropertyId: '111111', searchConsole: 'sc-domain:renault.it' },
        { id: 'b', url: 'https://www.dacia.it', brand: 'Dacia', ga4PropertyId: '222222', searchConsole: 'sc-domain:dacia.it' },
    ];

    it('legge Analytics e Search Console di ogni sito: una voce per sito, con l\'etichetta', async () => {
        const r = await getClientMarketingReport({ sites }, 'last_30d', windows);
        const g = r.filter((p) => p.platform === 'ga4');
        const s = r.filter((p) => p.platform === 'searchconsole');
        expect(g.map((p) => p.accountLabel)).toEqual(['Renault · www.renault.it', 'Dacia · www.dacia.it']);
        expect(g.map((p) => p.rows[0].sessions)).toEqual([3000, 2000]);
        expect(s.map((p) => p.accountLabel)).toEqual(['Renault · www.renault.it', 'Dacia · www.dacia.it']);
        expect(s.map((p) => p.rows[0].clicks)).toEqual([700, 300]);
        expect(ga4.totals).toHaveBeenCalledWith('111111', '2026-10-01', '2026-10-31');
        expect(ga4.totals).toHaveBeenCalledWith('222222', '2026-10-01', '2026-10-31');
    });

    it('un sito che non risponde non ferma gli altri: la sua voce è «non collegata», le altre restano', async () => {
        ga4.totals.mockImplementation(async (propertyId: string) => {
            if (propertyId === '222222') throw new Error('Permessi mancanti');
            return { sessions: 3000 };
        });
        const g = (await getClientMarketingReport({ sites }, 'last_30d', windows)).filter((p) => p.platform === 'ga4');
        expect(g).toHaveLength(2);
        expect(g.map((p) => p.connected)).toEqual([true, false]);
        expect(g[1].error).toContain('Permessi');
        expect(g[1].accountLabel).toBe('Dacia · www.dacia.it');
    });

    it('un cliente con un sito solo (o con i campi vecchi) ha il report di sempre: una voce, senza etichetta', async () => {
        const legacy = await getClientMarketingReport({ ga4PropertyId: '111111', windsorAccounts: { searchconsole: 'sc-domain:renault.it' } }, 'last_30d', windows);
        expect(legacy.filter((p) => p.platform === 'ga4')).toHaveLength(1);
        expect(legacy.find((p) => p.platform === 'ga4')!.accountLabel).toBeUndefined();
        const one = await getClientMarketingReport({ sites: [sites[0]] }, 'last_30d', windows);
        expect(one.filter((p) => p.platform === 'ga4')).toHaveLength(1);
        expect(one.find((p) => p.platform === 'ga4')!.accountLabel).toBeUndefined();
    });

    it('senza nessuna fonte il report è vuoto, come prima', async () => {
        expect(await getClientMarketingReport({}, 'last_30d', windows)).toEqual([]);
        expect(await getClientMarketingReport({ sites: [{ id: 'a', url: 'https://x.it' }] }, 'last_30d', windows)).toEqual([]);
    });
});
