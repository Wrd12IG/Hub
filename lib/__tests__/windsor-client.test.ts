import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getData } from '../windsor-client';

const rows = [
    { account_id: 'locations/1', impressions: 10 },
    { account_id: 'locations/2', impressions: 20 },
    { account_id: 'locations/3', impressions: 30 },
];

describe('getData con accountIds', () => {
    let urls: string[];

    beforeEach(() => {
        process.env.WINDSOR_API_KEY = 'test-key';
        urls = [];
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            urls.push(url);
            return { ok: true, json: async () => ({ data: rows }) } as any;
        }));
    });
    afterEach(() => vi.unstubAllGlobals());

    it('manda UN filtro account_id in [...] e tiene solo le sedi richieste', async () => {
        const out = await getData({ connector: 'google_my_business', accountIds: ['locations/1', 'locations/3'], fields: ['impressions', 'account_id'] });
        expect(urls).toHaveLength(1);
        const filter = JSON.parse(new URL(urls[0]).searchParams.get('filter')!);
        expect(filter).toEqual([['account_id', 'in', JSON.stringify(['locations/1', 'locations/3'])]]);
        expect(out.map(r => r.account_id)).toEqual(['locations/1', 'locations/3']);
    });

    it('un singolo accountId usa lo stesso filtro lato Windsor (prima chiedeva tutti gli account)', async () => {
        const out = await getData({ connector: 'facebook', accountId: 'locations/2', fields: ['impressions', 'account_id'] });
        const filter = JSON.parse(new URL(urls[0]).searchParams.get('filter')!);
        expect(filter).toEqual([['account_id', 'in', JSON.stringify(['locations/2'])]]);
        expect(out.map(r => r.account_id)).toEqual(['locations/2']);
    });

    it('senza accountIds né accountId non aggiunge nessun filtro (comportamento di prima)', async () => {
        const out = await getData({ connector: 'google_my_business', fields: ['impressions'] });
        expect(new URL(urls[0]).searchParams.has('filter')).toBe(false);
        expect(out).toHaveLength(3);
    });
});
