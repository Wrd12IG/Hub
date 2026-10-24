import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const TOKEN = '123456789:AAEhBP0av18ZZZZZZZZZZZZZZZZZZZZZZZZ';

describe('lib/telegram', () => {
    const fetchMock = vi.fn();
    beforeEach(() => { vi.resetModules(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); process.env.TELEGRAM_BOT_TOKEN = TOKEN; });
    afterEach(() => { delete process.env.TELEGRAM_BOT_TOKEN; });
    const ok = (result: unknown) => new Response(JSON.stringify({ ok: true, result }), { status: 200 });

    it('riconosce un token valido e rifiuta quelli sbagliati o assenti', async () => {
        const m = await import('../telegram');
        expect(m.isTelegramConfigured()).toBe(true);
        process.env.TELEGRAM_BOT_TOKEN = 'boh';
        expect(m.isTelegramConfigured()).toBe(false);
        delete process.env.TELEGRAM_BOT_TOKEN;
        expect(m.isTelegramConfigured()).toBe(false);
    });

    it('sendMessage: HTML, anteprime link spente, pulsante, testo tagliato a 4096', async () => {
        const m = await import('../telegram');
        fetchMock.mockResolvedValue(ok({}));
        await m.sendMessage(42, 'x'.repeat(5000), { button: { label: 'Apri il PED', url: 'https://hub.wrdigital.it/x' } });
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
        const body = JSON.parse(init.body);
        expect(body.chat_id).toBe(42);
        expect(body.parse_mode).toBe('HTML');
        expect(body.text.length).toBe(4096);
        expect(body.reply_markup.inline_keyboard[0][0]).toEqual({ text: 'Apri il PED', url: 'https://hub.wrdigital.it/x' });
    });

    it('sendPhoto: didascalia tagliata a 1024', async () => {
        const m = await import('../telegram');
        fetchMock.mockResolvedValue(ok({}));
        await m.sendPhoto(42, 'https://x/y.jpg', 'c'.repeat(2000));
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.photo).toBe('https://x/y.jpg');
        expect(body.caption.length).toBe(1024);
    });

    it('escapeHtml neutralizza i caratteri speciali', async () => {
        const m = await import('../telegram');
        expect(m.escapeHtml('<b>Rosso & blu</b>')).toBe('&lt;b&gt;Rosso &amp; blu&lt;/b&gt;');
    });

    it('un errore di Telegram diventa un messaggio chiaro, senza il token', async () => {
        const m = await import('../telegram');
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: false, description: 'Forbidden: bot was blocked by the user' }), { status: 403 }));
        await expect(m.sendMessage(1, 'x')).rejects.toThrow('Telegram: Forbidden: bot was blocked by the user');
    });

    it('un errore di rete non lascia trapelare il token', async () => {
        const m = await import('../telegram');
        fetchMock.mockRejectedValue(new Error(`getaddrinfo ENOTFOUND api.telegram.org/bot${TOKEN}/sendMessage`));
        const err = await m.sendMessage(1, 'x').catch((e) => e);
        expect(String(err.message)).not.toContain(TOKEN);
        expect(String(err.message)).toContain('non raggiungibile');
    });

    it('senza token non chiama la rete', async () => {
        delete process.env.TELEGRAM_BOT_TOKEN;
        const m = await import('../telegram');
        await expect(m.getMe()).rejects.toThrow('manca TELEGRAM_BOT_TOKEN');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
