// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase-admin', () => ({ adminDb: { collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ set: async () => undefined }) }) }) }) } }));

const call = async (headers: Record<string, string> = {}) => {
    const { POST } = await import('@/app/api/webhooks/n8n/route');
    return POST(new Request('http://x/api/webhooks/n8n', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{}' }));
};

afterEach(() => { vi.unstubAllEnvs(); });

describe('webhook n8n: chiuso senza segreto', () => {
    it('senza N8N_WEBHOOK_SECRET rifiuta tutto (prima lasciava passare chiunque)', async () => {
        vi.stubEnv('N8N_WEBHOOK_SECRET', '');
        const r = await call({ authorization: 'Bearer qualunque' });
        expect(r.status).toBe(503);
    });
    it('con il segreto: senza intestazione o con segreto sbagliato 401', async () => {
        vi.stubEnv('N8N_WEBHOOK_SECRET', 'segreto-di-prova');
        expect((await call()).status).toBe(401);
        expect((await call({ authorization: 'Bearer sbagliato' })).status).toBe(401);
    });
    it('con il segreto giusto supera il controllo (poi valida il contenuto)', async () => {
        vi.stubEnv('N8N_WEBHOOK_SECRET', 'segreto-di-prova');
        const r = await call({ authorization: 'Bearer segreto-di-prova' });
        expect(r.status).not.toBe(401);
        expect(r.status).not.toBe(503);
    });
});
