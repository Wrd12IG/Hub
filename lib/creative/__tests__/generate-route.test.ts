import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { user: { uid: 'u1' } as any, staffDenied: null as any, claudeOn: true, claudeOut: null as any, clientExists: true };
const calls: { prompt?: string; system?: string } = {};

vi.mock('@/lib/api-auth', () => ({
    verifyAuth: async () => state.user,
    unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    denyUnlessStaff: async () => state.staffDenied,
}));
vi.mock('@/lib/firebase-admin', () => ({
    adminDb: {
        collection: (name: string) => ({
            doc: () => ({ get: async () => ({ exists: state.clientExists, data: () => ({ name: 'City Motors', socialProfile: { sector: 'Automotive', toneOfVoice: 'diretto' } }) }) }),
            where: () => ({ limit: () => ({ get: async () => ({ docs: [{ data: () => ({ topic: 'Promo estate', publicationDate: '2026-07-01' }) }] }) }) }),
        }),
    },
}));
vi.mock('@/lib/claude', () => ({
    isClaudeConfigured: () => state.claudeOn,
    askClaudeJson: async (o: any) => { calls.prompt = o.prompt; calls.system = o.system; if (state.claudeOut instanceof Error) throw state.claudeOut; return state.claudeOut; },
}));

import { POST } from '@/app/api/clients/[id]/creative/generate/route';

const req = (body: unknown) => new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }) as any;
const ok = { kind: 'caption', channel: 'instagram', goal: 'saves', topic: 'Open weekend Yaris Cross sabato 8 novembre', facts: 'Rata 199 euro' };

describe('POST /api/clients/[id]/creative/generate', () => {
    beforeEach(() => { state.user = { uid: 'u1' }; state.staffDenied = null; state.claudeOn = true; state.clientExists = true; state.claudeOut = { items: [{ formula: 'IG1', formulaName: 'Numero', hook: 'Rata 199 euro', caption: 'Rata 199 euro, sabato 8 novembre. Ne hai venduti 4.200?' }] }; });

    it('401 senza accesso', async () => {
        state.user = null;
        expect((await POST(req(ok), { params: { id: 'c1' } })).status).toBe(401);
    });
    it('403 per chi non è staff (nessuna chiamata all\'AI)', async () => {
        state.staffDenied = new Response('{}', { status: 403 });
        calls.prompt = undefined;
        expect((await POST(req(ok), { params: { id: 'c1' } })).status).toBe(403);
        expect(calls.prompt).toBeUndefined();
    });
    it('400 su richiesta non valida', async () => {
        const r = await POST(req({ ...ok, topic: '' }), { params: { id: 'c1' } });
        expect(r.status).toBe(400);
    });
    it('503 senza chiave AI, 404 cliente inesistente', async () => {
        state.claudeOn = false;
        expect((await POST(req(ok), { params: { id: 'c1' } })).status).toBe(503);
        state.claudeOn = true; state.clientExists = false;
        expect((await POST(req(ok), { params: { id: 'c1' } })).status).toBe(404);
    });
    it('200: usa i dati del cliente nel prompt e segnala il numero inventato', async () => {
        const r = await POST(req(ok), { params: { id: 'c1' } });
        expect(r.status).toBe(200);
        const d = await r.json();
        expect(calls.prompt).toContain('City Motors');
        expect(calls.prompt).toContain('Promo estate');
        expect(d.usedProfile).toBe(true);
        expect(d.items).toHaveLength(1);
        expect(d.items[0].warnings.some((w: string) => w.includes('4.200'))).toBe(true);
        expect(d.items[0].warnings.some((w: string) => w.includes('199'))).toBe(false);
    });
    it('502 se l\'AI non restituisce nulla di utilizzabile o va in errore', async () => {
        state.claudeOut = { items: [] };
        expect((await POST(req(ok), { params: { id: 'c1' } })).status).toBe(502);
        state.claudeOut = new Error('timeout');
        expect((await POST(req(ok), { params: { id: 'c1' } })).status).toBe(502);
    });
});
