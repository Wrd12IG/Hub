import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = { user: { uid: 'u1' } as any, denied: null as any, claudeOn: true, out: null as any, loaded: true };
const calls: { prompt?: string; system?: string }[] = [];

vi.mock('@/lib/api-auth', () => ({
    verifyAuth: async () => state.user,
    unauthorizedResponse: () => new Response('{"error":"Unauthorized"}', { status: 401 }),
    denyUnlessStaff: async () => state.denied,
}));
vi.mock('@/lib/creative/context', () => ({
    loadClientContext: async () => (state.loaded ? { usedProfile: true, ctx: { name: 'City Motors', sector: 'Automotive', toneOfVoice: 'diretto', recentTopics: ['Promo estate'] } } : null),
}));
vi.mock('@/lib/claude', () => ({
    isClaudeConfigured: () => state.claudeOn,
    askClaudeJson: async (o: any) => { calls.push({ prompt: o.prompt, system: o.system }); if (state.out instanceof Error) throw state.out; return state.out; },
}));

import { POST } from '@/app/api/clients/[id]/ped-plan/route';

const req = (body: unknown) => new Request('http://x/api', { method: 'POST', body: JSON.stringify(body) }) as any;
const ctx = { params: { id: 'c1' } };
const skel = { stage: 'skeleton', period: 'week', startDate: '2026-11-02', goal: 'leads', events: 'Open weekend sabato 8 novembre', facts: 'Rata da 199 euro' };

beforeEach(() => { state.user = { uid: 'u1' }; state.denied = null; state.claudeOn = true; state.loaded = true; calls.length = 0; });

describe('POST /api/clients/[id]/ped-plan', () => {
    it('401, 403, 503 e 404', async () => {
        state.user = null;
        expect((await POST(req(skel), ctx)).status).toBe(401);
        state.user = { uid: 'u1' }; state.denied = new Response('{}', { status: 403 });
        expect((await POST(req(skel), ctx)).status).toBe(403);
        state.denied = null; state.claudeOn = false;
        expect((await POST(req(skel), ctx)).status).toBe(503);
        state.claudeOn = true; state.loaded = false;
        expect((await POST(req(skel), ctx)).status).toBe(404);
    });
    it('richiesta non valida: 400', async () => {
        expect((await POST(req({ ...skel, period: 'anno' }), ctx)).status).toBe(400);
        expect((await POST(req({ stage: 'boh' }), ctx)).status).toBe(400);
        expect((await POST(req({ stage: 'detail', post: { date: 'x' } }), ctx)).status).toBe(400);
    });
    it('scheletro: usa i dati del cliente, scarta ciò che è fuori periodo e segnala il mix', async () => {
        state.out = { posts: [
            { date: '2026-11-03', time: '19:00', format: 'Carosello', postType: 'insegna', theme: 'a', angle: 'b' },
            { date: '2026-11-04', time: '19:00', format: 'Carosello', postType: 'insegna', theme: 'c', angle: 'd' },
            { date: '2027-01-10', time: '19:00', format: 'Reel', postType: 'prova', theme: 'fuori', angle: 'x' },
        ] };
        const r = await POST(req(skel), ctx);
        expect(r.status).toBe(200);
        const d = await r.json();
        expect(calls[0].prompt).toContain('City Motors');
        expect(calls[0].prompt).toContain('Open weekend');
        expect(calls[0].system).toContain('FORMULE DI AGGANCIO');
        expect(d.posts).toHaveLength(2);
        expect(d.warnings.some((w: string) => w.includes('Reel su 2'))).toBe(true);
        expect(d.warnings.some((w: string) => w.includes('di fila'))).toBe(true);
    });
    it('scheletro: se l\'AI non dà nulla di utilizzabile o va in errore, 502', async () => {
        state.out = { posts: [] };
        expect((await POST(req(skel), ctx)).status).toBe(502);
        state.out = new Error('timeout');
        expect((await POST(req(skel), ctx)).status).toBe(502);
    });
    const post = { id: 'p3', date: '2026-11-04', time: '19:00', format: 'Reel', postType: 'prova', theme: 'Preventivi', angle: 'Rata da 199 euro', hookFormula: 5, photoBrief: '' };
    const detailBody = { stage: 'detail', post, goal: 'leads', events: '', facts: 'Rata da 199 euro' };
    it('dettaglio Reel: punteggio dell\'aggancio, avviso se un\'alternativa è migliore, numeri inventati segnalati', async () => {
        state.out = {
            hook: { formulaId: 5, spoken: 'Ciao ragazzi oggi vi parlo di auto', onScreen: 'AUTO', alternatives: [{ spoken: '199 euro al mese è quanto costa davvero questa Yaris', onScreen: '199 EURO' }] },
            caption: 'Ne abbiamo consegnate 4.200.\n\nScrivi PREVENTIVO.', hashtags: ['#toyota'], cta: 'Scrivi PREVENTIVO',
            reel: { durationSec: 12, script: ['Ciao ragazzi oggi vi parlo di auto', 'Rata da 199 euro al mese.', 'Scrivi preventivo.'], cards: [{ text: 'AUTO', from: 0, to: 3 }], shots: ['banco'] },
        };
        const r = await POST(req(detailBody), ctx);
        expect(r.status).toBe(200);
        const d = (await r.json()).post;
        expect(d.id).toBe('p3');
        expect(d.hookScore).toBeLessThan(50);
        expect(d.hook.alternatives[0].score).toBeGreaterThan(d.hookScore);
        expect(d.warnings.some((w: string) => w.includes('alternativo'))).toBe(true);
        expect(d.warnings.some((w: string) => w.includes('Aggancio debole'))).toBe(true);
        expect(d.warnings.some((w: string) => w.includes('4.200'))).toBe(true);
        expect(calls[0].prompt).toContain('Rata da 199 euro');
        expect(calls[0].system).toContain('metodo ig-reel');
    });
    it('dettaglio Carosello usa il metodo del carosello; Storia quello delle storie', async () => {
        state.out = { caption: 'x', carousel: { slides: [{ role: 'copertina', headline: 'Titolo', body: '' }] } };
        await POST(req({ ...detailBody, post: { ...post, format: 'Carosello', hookFormula: null } }), ctx);
        expect(calls[0].system).toContain('metodo ig-carousel');
        state.out = { story: { frames: [{ text: 'Apertura', sticker: '', stickerText: '', options: [] }] } };
        await POST(req({ ...detailBody, post: { ...post, format: 'Storia', hookFormula: null } }), ctx);
        expect(calls[1].system).toContain('metodo ig-story');
    });
    it('dettaglio: risposta senza contenuto o errore = 502', async () => {
        state.out = { caption: 'solo didascalia' }; // Reel senza copione
        expect((await POST(req(detailBody), ctx)).status).toBe(502);
        state.out = new Error('x');
        expect((await POST(req(detailBody), ctx)).status).toBe(502);
    });
});
