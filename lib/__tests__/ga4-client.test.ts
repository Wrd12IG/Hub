import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('google-auth-library', () => ({
    OAuth2Client: class { setCredentials() {} async getAccessToken() { return { token: 'tok' }; } },
}));

import { makeGa4Runner, isAccessError, getGA4Totals, type Ga4Source } from '../ga4-client';

const ok = (tag: string): Ga4Source['run'] => async () => [{ tag, rows: [] }];
const fail = (code: number, message: string): Ga4Source['run'] => async () => { const e: any = new Error(message); e.code = code; throw e; };
const src = (name: Ga4Source['name'], run: Ga4Source['run']): Ga4Source => ({ name, run });
const REQ = { property: 'properties/123' };

describe('isAccessError', () => {
    it('riconosce permessi negati, token revocato e ambito mancante', () => {
        expect(isAccessError({ code: 7 })).toBe(true);
        expect(isAccessError({ code: 16 })).toBe(true);
        expect(isAccessError(new Error('invalid_grant'))).toBe(true);
        expect(isAccessError(new Error('Request had insufficient authentication scopes'))).toBe(true);
    });
    it('non scambia per un problema d\'accesso un errore diverso', () => {
        expect(isAccessError({ code: 5, message: 'not found' })).toBe(false);
        expect(isAccessError(new Error('ECONNRESET'))).toBe(false);
        expect(isAccessError({ code: 8, message: 'quota exhausted' })).toBe(false);
    });
});

describe('makeGa4Runner', () => {
    it('usa il primo accesso che funziona e non chiama l\'altro', async () => {
        const second = vi.fn(ok('service'));
        const r = makeGa4Runner([src('account', ok('account')), src('service', second)]);
        expect((await r.runReport(REQ))[0].tag).toBe('account');
        expect(second).not.toHaveBeenCalled();
    });
    it('se l\'account Google non ha il permesso, ripiega sul service account', async () => {
        const r = makeGa4Runner([src('account', fail(7, 'permission denied')), src('service', ok('service'))]);
        expect((await r.runReport(REQ))[0].tag).toBe('service');
    });
    it('token revocato: ripiega sul service account', async () => {
        const r = makeGa4Runner([src('account', fail(16, 'invalid_grant')), src('service', ok('service'))]);
        expect((await r.runReport(REQ))[0].tag).toBe('service');
    });
    it('ricorda per proprietà quale accesso ha funzionato e parte da quello', async () => {
        const account = vi.fn(fail(7, 'permission denied'));
        const memo = new Map();
        const r = makeGa4Runner([src('account', account), src('service', ok('service'))], memo);
        await r.runReport(REQ);
        await r.runReport(REQ);
        expect(account).toHaveBeenCalledTimes(1); // la seconda volta parte dal service account
        expect(memo.get('properties/123')).toBe('service');
    });
    it('una proprietà non blocca le altre: la memoria è per proprietà', async () => {
        const account = vi.fn(ok('account'));
        const memo = new Map([['properties/999', 'service' as const]]);
        const r = makeGa4Runner([src('account', account), src('service', ok('service'))], memo);
        await r.runReport(REQ);
        expect(account).toHaveBeenCalledTimes(1);
    });
    it('errori che non riguardano l\'accesso non cambiano strada', async () => {
        const second = vi.fn(ok('service'));
        const r = makeGa4Runner([src('account', fail(5, 'property not found')), src('service', second)]);
        await expect(r.runReport(REQ)).rejects.toThrow('not found');
        expect(second).not.toHaveBeenCalled();
    });
    it('entrambi senza permesso: un errore solo, marcato', async () => {
        const r = makeGa4Runner([src('account', fail(7, 'denied')), src('service', fail(7, 'denied'))]);
        await expect(r.runReport(REQ)).rejects.toMatchObject({ both: true, code: 7 });
    });
    it('un solo accesso senza permesso: l\'errore originale', async () => {
        const r = makeGa4Runner([src('service', fail(7, 'permission denied'))]);
        await expect(r.runReport(REQ)).rejects.toMatchObject({ code: 7, message: 'permission denied' });
    });
});

describe('accesso con l\'account Google (chiamata REST)', () => {
    const saved = { ...process.env };
    beforeEach(() => {
        process.env.GA4_OAUTH_REFRESH_TOKEN = 'rt'; process.env.GA4_OAUTH_CLIENT_ID = 'cid'; process.env.GA4_OAUTH_CLIENT_SECRET = 'cs';
        delete process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_EMAIL; delete process.env.GOOGLE_ANALYTICS_PRIVATE_KEY;
    });
    afterEach(() => { process.env = { ...saved }; vi.restoreAllMocks(); });

    it('legge i totali con il token dell\'account e mette le risposte nelle chiavi delle schede', async () => {
        const calls: { url: string; body: any; headers: Record<string, string> }[] = [];
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init?: any) => {
            const url = String(input);
            calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
            const names = (JSON.parse(init.body).metrics as { name: string }[]).map((m) => m.name);
            return new Response(JSON.stringify({ rows: [{ metricValues: names.map((_, i) => ({ value: String(i + 1) })) }] }), { status: 200 });
        });
        const t = await getGA4Totals('266597631', '2026-10-01', '2026-10-31');
        expect(calls.length).toBe(2);
        expect(calls[0].url).toBe('https://analyticsdata.googleapis.com/v1beta/properties/266597631:runReport');
        expect(calls[0].headers.Authorization).toBe('Bearer tok');
        expect(calls[0].body.property).toBeUndefined(); // la proprietà sta nell'indirizzo, non nel corpo
        expect(calls[0].body.dateRanges).toEqual([{ startDate: '2026-10-01', endDate: '2026-10-31' }]);
        expect(t.sessions).toBe(1);
        expect(t.active_users).toBe(2);
        expect(t.purchase_revenue).toBe(5);
    });

    it('permesso negato dall\'API: errore leggibile, con indicazioni per l\'account Google', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
            return new Response(JSON.stringify({ error: { message: 'User does not have sufficient permissions for this property' } }), { status: 403 });
        });
        await expect(getGA4Totals('111111', '2026-10-01', '2026-10-31')).rejects.toThrow(/account Google dell'agenzia non vede la proprietà GA4 111111/);
    });

    it('senza nessuna credenziale spiega cosa manca', async () => {
        delete process.env.GA4_OAUTH_REFRESH_TOKEN;
        await expect(getGA4Totals('111111', '2026-10-01', '2026-10-31')).rejects.toThrow(/Mancano le credenziali per GA4/);
    });
});
