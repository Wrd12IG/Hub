import { describe, it, expect } from 'vitest';
import { describeSchedule, publicationValue, splitPublicationValue } from '../schedule';
import { runAfterSave } from '../../../components/story-editor/after-save';

const NOW = new Date('2026-10-24T10:00:00Z');

describe('publicationValue / splitPublicationValue', () => {
    it('solo giorno → solo giorno; giorno e ora → istante; vuoto → vuoto', () => {
        expect(publicationValue('2026-10-26', '')).toBe('2026-10-26');
        expect(publicationValue('', '10:00')).toBe('');
        expect(publicationValue('boh', '10:00')).toBe('');
        expect(publicationValue('2026-10-26', '18:30')).toMatch(/^2026-10-26T|^2026-10-2[56]T/);
    });
    it('andata e ritorno', () => {
        expect(splitPublicationValue('2026-10-26')).toEqual({ day: '2026-10-26', time: '' });
        const v = publicationValue('2026-10-26', '18:30');
        expect(splitPublicationValue(v)).toEqual({ day: '2026-10-26', time: '18:30' });
        expect(splitPublicationValue(undefined)).toEqual({ day: '', time: '' });
        expect(splitPublicationValue('xx')).toEqual({ day: '', time: '' });
    });
});

describe('describeSchedule: cosa succede dopo il salvataggio', () => {
    it('bozza: non esce, con o senza data', () => {
        expect(describeSchedule({ publicationDate: '', afterSave: 'draft', now: NOW }).text).toContain('Resta in bozza');
        expect(describeSchedule({ publicationDate: '2026-10-26', afterSave: 'draft', now: NOW }).text).toContain('Non esce finché non viene approvata');
    });
    it('richiesta al cliente con data: esce da sola dopo l\'approvazione; senza data avvisa', () => {
        const ok = describeSchedule({ publicationDate: '2026-10-26', afterSave: 'request', now: NOW });
        expect(ok.tone).toBe('ok');
        expect(ok.text).toContain('esce da sola');
        const warn = describeSchedule({ publicationDate: '', afterSave: 'request', now: NOW });
        expect(warn.tone).toBe('warn');
        expect(warn.text).toContain('senza una data');
    });
    it('approva: futura = ok; appena passata = esce a breve; oltre 3 giorni = non esce; senza data = avviso', () => {
        expect(describeSchedule({ publicationDate: '2026-10-26', afterSave: 'approve', now: NOW })).toMatchObject({ tone: 'ok' });
        const due = describeSchedule({ publicationDate: '2026-10-24', afterSave: 'approve', now: NOW });
        expect(due.tone).toBe('warn');
        expect(due.text).toContain('esce entro pochi minuti');
        const late = describeSchedule({ publicationDate: '2026-10-10', afterSave: 'approve', now: NOW });
        expect(late.text).toContain('più di 3 giorni');
        expect(describeSchedule({ publicationDate: '', afterSave: 'approve', now: NOW }).text).toContain('senza data');
    });
});

describe('runAfterSave', () => {
    const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    it('bozza: non chiama nulla', async () => {
        let called = false;
        expect(await runAfterSave({ clientId: 'c', contentId: 'x', mode: 'draft', post: async () => { called = true; return res(200, {}); } })).toBeNull();
        expect(called).toBe(false);
    });
    it('richiesta: manda bypass false con l\'id giusto e restituisce il link', async () => {
        let sent: any;
        const r = await runAfterSave({ clientId: 'c1', contentId: 'x1', mode: 'request', post: async (u, i) => { sent = { u, body: JSON.parse(i.body) }; return res(200, { shareUrl: 'https://hub/share/t' }); } });
        expect(sent).toEqual({ u: '/api/clients/c1/editorial-approval', body: { contentIds: ['x1'], bypass: false } });
        expect(r).toMatchObject({ level: 'success', shareUrl: 'https://hub/share/t' });
    });
    it('approva: bypass true; senza link pubblico avvisa; saltato → avviso; errore → errore che dice che è salvata in bozza', async () => {
        let bypass: unknown;
        const ok = await runAfterSave({ clientId: 'c', contentId: 'x', mode: 'approve', post: async (_u, i) => { bypass = JSON.parse(i.body).bypass; return res(200, {}); } });
        expect(bypass).toBe(true);
        expect(ok).toMatchObject({ level: 'success' });
        expect(await runAfterSave({ clientId: 'c', contentId: 'x', mode: 'request', post: async () => res(200, {}) })).toMatchObject({ level: 'warning' });
        expect(await runAfterSave({ clientId: 'c', contentId: 'x', mode: 'request', post: async () => res(200, { skipped: [{ id: 'x', reason: 'già in attesa del cliente' }] }) })).toMatchObject({ level: 'warning', message: expect.stringContaining('già in attesa') });
        const err = await runAfterSave({ clientId: 'c', contentId: 'x', mode: 'approve', post: async () => res(403, { error: 'Forbidden' }) });
        expect(err?.level).toBe('error');
        expect(err?.message).toContain('Salvata come bozza');
        const net = await runAfterSave({ clientId: 'c', contentId: 'x', mode: 'request', post: async () => { throw new Error('rete'); } });
        expect(net?.level).toBe('error');
    });
});
