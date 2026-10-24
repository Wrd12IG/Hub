import { describe, it, expect, vi, beforeEach } from 'vitest';

const TOKEN = '123456789:AAEhBP0av18ZZZZZZZZZZZZZZZZZZZZZZZZ';

// ── finto Firestore: utenti con percorsi annidati ──
type Doc = { id: string; data: Record<string, any> };
let users: Doc[] = [];
const updates: { id: string; patch: Record<string, any> }[] = [];
const pick = (o: any, path: string) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const mkDoc = (d: Doc) => ({ id: d.id, data: () => d.data, ref: { update: async (patch: any) => { updates.push({ id: d.id, patch }); } } });
vi.mock('@/lib/firebase-admin', () => ({
    adminDb: { collection: () => ({
        where: (f: string, _op: string, v: unknown) => { const hit = users.filter((u) => pick(u.data, f) === v); return { limit: () => ({ get: async () => ({ docs: hit.slice(0, 1).map(mkDoc), empty: hit.length === 0 }) }), get: async () => ({ docs: hit.map(mkDoc), empty: hit.length === 0 }) }; },
        doc: (id: string) => ({ update: async (patch: any) => { updates.push({ id, patch }); }, get: async () => ({ data: () => users.find((u) => u.id === id)?.data }) }),
    }) },
}));

const auth = { user: { uid: 'u1' } as any, denied: null as any, appUser: { id: 'u1', role: 'Amministratore' } as any };
vi.mock('@/lib/api-auth', () => ({
    verifyAuth: async () => auth.user,
    unauthorizedResponse: () => new Response('{"error":"Unauthorized"}', { status: 401 }),
    denyUnlessStaff: async () => auth.denied,
    forbiddenResponse: () => new Response('{"error":"Forbidden"}', { status: 403 }),
    getAppUser: async () => auth.appUser,
}));

const sent: { chat: unknown; html: string }[] = [];
const tg = { setWebhookCalled: null as any, throwOn: '' };
vi.mock('@/lib/telegram', async (orig) => {
    const real = await orig<typeof import('@/lib/telegram')>();
    return {
        ...real,
        sendMessage: vi.fn(async (chat: unknown, html: string) => { if (tg.throwOn === 'send') throw new Error('Telegram: Forbidden'); sent.push({ chat, html }); }),
        getMe: vi.fn(async () => ({ id: 1, username: 'WRHubBot', first_name: 'Hub' })),
        getWebhookInfo: vi.fn(async () => ({ url: 'https://hub.wrdigital.it/api/telegram/webhook' })),
        setWebhook: vi.fn(async (url: string, secret: string) => { tg.setWebhookCalled = { url, secret }; return true; }),
    };
});

import { POST as webhook } from '@/app/api/telegram/webhook/route';
import { GET as status, POST as action } from '@/app/api/telegram/route';
import { webhookSecret } from '@/lib/telegram-link';

const wh = (update: unknown, secret: string | null = webhookSecret(TOKEN)) =>
    new Request('http://x/api/telegram/webhook', { method: 'POST', headers: secret ? { 'x-telegram-bot-api-secret-token': secret } : {}, body: JSON.stringify(update) }) as any;
const msg = (text: string, type = 'private') => ({ message: { chat: { id: 555, type }, text } });
const post = (body: unknown) => new Request('http://x/api/telegram', { method: 'POST', body: JSON.stringify(body) }) as any;

beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = TOKEN;
    users = [{ id: 'u1', data: { name: 'Roberto', role: 'Amministratore', telegramLink: { code: 'abcdef0123456789abcdef01', expiresAt: Date.now() + 60_000 } } }];
    updates.length = 0; sent.length = 0; tg.setWebhookCalled = null; tg.throwOn = '';
    auth.user = { uid: 'u1' }; auth.denied = null; auth.appUser = { id: 'u1', role: 'Amministratore' };
});

describe('webhook', () => {
    it('401 senza il segreto o con quello sbagliato, e non fa nulla', async () => {
        expect((await webhook(wh(msg('/start abcdef0123456789abcdef01'), null))).status).toBe(401);
        expect((await webhook(wh(msg('/start abcdef0123456789abcdef01'), 'sbagliato'))).status).toBe(401);
        expect(updates).toHaveLength(0);
        expect(sent).toHaveLength(0);
    });
    it('401 se il bot non è configurato', async () => {
        delete process.env.TELEGRAM_BOT_TOKEN;
        expect((await webhook(wh(msg('/start x'), 'qualsiasi'))).status).toBe(401);
    });
    it('/start con il codice giusto collega la chat a quell\'utente e risponde', async () => {
        const r = await webhook(wh(msg('/start abcdef0123456789abcdef01')));
        expect(r.status).toBe(200);
        expect(updates).toHaveLength(1);
        expect(updates[0].id).toBe('u1');
        expect(updates[0].patch.telegramChatId).toBe('555');
        expect(sent[0].html).toContain('Collegato');
        expect(sent[0].html).toContain('Roberto');
    });
    it('codice scaduto: non collega e lo dice', async () => {
        users[0].data.telegramLink.expiresAt = Date.now() - 1;
        await webhook(wh(msg('/start abcdef0123456789abcdef01')));
        expect(updates).toHaveLength(0);
        expect(sent[0].html).toContain('scaduto');
    });
    it('codice sconosciuto: non collega', async () => {
        await webhook(wh(msg('/start ffffffffffffffffffffffff')));
        expect(updates).toHaveLength(0);
        expect(sent[0].html).toContain('scaduto');
    });
    it('gruppi e canali sono ignorati', async () => {
        await webhook(wh(msg('/start abcdef0123456789abcdef01', 'group')));
        expect(updates).toHaveLength(0);
        expect(sent).toHaveLength(0);
    });
    it('/start senza codice spiega come collegare; /scollega toglie il collegamento', async () => {
        await webhook(wh(msg('/start')));
        expect(sent[0].html).toContain('Collega Telegram');
        users = [{ id: 'u1', data: { name: 'R', telegramChatId: '555' } }];
        sent.length = 0;
        await webhook(wh(msg('/scollega')));
        expect(updates.some((u) => u.id === 'u1' && 'telegramChatId' in u.patch)).toBe(true);
        expect(sent[0].html).toContain('Scollegato');
    });
    it('un errore interno non rompe la risposta a Telegram (200)', async () => {
        tg.throwOn = 'send';
        expect((await webhook(wh(msg('/start abcdef0123456789abcdef01')))).status).toBe(200);
    });
});

describe('/api/telegram', () => {
    it('401 senza accesso, 403 per chi non è staff', async () => {
        auth.user = null;
        expect((await status(new Request('http://x') as any)).status).toBe(401);
        auth.user = { uid: 'u1' }; auth.denied = new Response('{}', { status: 403 });
        expect((await action(post({ action: 'link' }))).status).toBe(403);
    });
    it('GET: non configurato / configurato (con stato del webhook solo per gli amministratori)', async () => {
        delete process.env.TELEGRAM_BOT_TOKEN;
        expect(await (await status(new Request('http://x') as any)).json()).toMatchObject({ configured: false, linked: false });
        process.env.TELEGRAM_BOT_TOKEN = TOKEN;
        expect(await (await status(new Request('http://x') as any)).json()).toMatchObject({ configured: true, botUsername: 'WRHubBot', webhookReady: true, isAdmin: true });
        auth.appUser = { id: 'u1', role: 'Collaboratore', telegramChatId: '9' };
        const d = await (await status(new Request('http://x') as any)).json();
        expect(d.isAdmin).toBe(false);
        expect(d.webhookReady).toBeNull();
        expect(d.linked).toBe(true);
    });
    it('POST senza token configurato: 503', async () => {
        delete process.env.TELEGRAM_BOT_TOKEN;
        expect((await action(post({ action: 'link' }))).status).toBe(503);
    });
    it('link: salva un codice con scadenza e restituisce il link del bot', async () => {
        const d = await (await action(post({ action: 'link' }))).json();
        expect(d.url).toMatch(/^https:\/\/t\.me\/WRHubBot\?start=[0-9a-f]{24}$/);
        const patch = updates.find((u) => u.id === 'u1')!.patch;
        expect(patch.telegramLink.code).toBe(d.url.split('start=')[1]);
        expect(patch.telegramLink.expiresAt).toBeGreaterThan(Date.now());
    });
    it('setup: solo amministratori, e imposta il webhook con il segreto derivato', async () => {
        auth.appUser = { id: 'u1', role: 'Collaboratore' };
        expect((await action(post({ action: 'setup' }))).status).toBe(403);
        expect(tg.setWebhookCalled).toBeNull();
        auth.appUser = { id: 'u1', role: 'Amministratore' };
        expect((await action(post({ action: 'setup' }))).status).toBe(200);
        expect(tg.setWebhookCalled).toEqual({ url: 'https://hub.wrdigital.it/api/telegram/webhook', secret: webhookSecret(TOKEN) });
    });
    it('test: senza collegamento 409; collegato manda il messaggio alla chat dell\'utente', async () => {
        expect((await action(post({ action: 'test' }))).status).toBe(409);
        users[0].data.telegramChatId = '555';
        expect((await action(post({ action: 'test' }))).status).toBe(200);
        expect(sent[0]).toMatchObject({ chat: '555' });
        expect(sent[0].html).toContain('Prova riuscita');
    });
    it('test: se Telegram rifiuta (bot bloccato) risponde 502 con il motivo', async () => {
        users[0].data.telegramChatId = '555'; tg.throwOn = 'send';
        const r = await action(post({ action: 'test' }));
        expect(r.status).toBe(502);
        expect((await r.json()).error).toContain('Forbidden');
    });
    it('unlink toglie il collegamento; azione sconosciuta 400', async () => {
        expect((await action(post({ action: 'unlink' }))).status).toBe(200);
        expect('telegramChatId' in updates[0].patch).toBe(true);
        expect((await action(post({ action: 'boh' }))).status).toBe(400);
    });
});
