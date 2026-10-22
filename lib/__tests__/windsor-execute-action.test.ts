import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeAction } from '../windsor-client';

describe('executeAction', () => {
    const realFetch = global.fetch;
    beforeEach(() => { process.env.WINDSOR_API_KEY = 'k'; });
    afterEach(() => { global.fetch = realFetch; });

    it('usa la forma documentata: POST /{connector}/actions con account, action e params', async () => {
        const f = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: 'ok' }) });
        global.fetch = f as any;
        await executeAction('instagram', 'create_image_post', '17841445354064961', { image_url: 'https://x/a.jpg' });
        const [url, init] = f.mock.calls[0];
        expect(url).toBe('https://connectors.windsor.ai/instagram/actions?api_key=k');
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toEqual({ account: '17841445354064961', action: 'create_image_post', params: { image_url: 'https://x/a.jpg' } });
    });
    it('senza account non chiama Windsor', async () => {
        const f = vi.fn(); global.fetch = f as any;
        await expect(executeAction('instagram', 'create_image_post', ' ', {})).rejects.toThrow('account mancante');
        expect(f).not.toHaveBeenCalled();
    });
    it('un errore HTTP porta il motivo', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'account non collegato' }) as any;
        await expect(executeAction('instagram', 'create_image_post', 'x', {})).rejects.toThrow(/400.*account non collegato/);
    });
});
