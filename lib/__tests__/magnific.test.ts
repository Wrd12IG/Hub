import { describe, it, expect } from 'vitest';
import { buildMysticBody, checkPrompt, describeHttpError, extensionFor, isSafeRemoteUrl, nextCount, normalizeTask, parseLimit, usageKey } from '../magnific/core';

describe('normalizeTask', () => {
    it('legge un\'operazione completata, tenendo solo gli indirizzi https', () => {
        const t = normalizeTask({ data: { task_id: 'abc', status: 'COMPLETED', generated: ['https://cdn.x/a.jpg', 'http://cdn.x/b.jpg', 5] } });
        expect(t).toEqual({ taskId: 'abc', status: 'COMPLETED', generated: ['https://cdn.x/a.jpg'] });
    });
    it('in corso, senza risultati', () => expect(normalizeTask({ data: { task_id: 't', status: 'IN_PROGRESS', generated: [] } })?.generated).toEqual([]));
    it('forme strane → null', () => {
        expect(normalizeTask(null)).toBeNull();
        expect(normalizeTask({ data: { status: 'COMPLETED' } })).toBeNull();
        expect(normalizeTask({ data: { task_id: 't', status: 'BOH' } })).toBeNull();
    });
});

describe('richiesta di generazione', () => {
    it('formato storia 9:16, modello realistico', () => {
        expect(buildMysticBody('  Una Toyota rossa al tramonto ', '1k')).toEqual({ prompt: 'Una Toyota rossa al tramonto', aspect_ratio: 'social_story_9_16', resolution: '1k', model: 'realism' });
        expect(buildMysticBody('x'.repeat(10)).resolution).toBe('2k');
    });
    it('controlla la descrizione', () => {
        expect(checkPrompt('ok')).toMatchObject({ ok: false });
        expect(checkPrompt(undefined)).toMatchObject({ ok: false });
        expect(checkPrompt('x'.repeat(601))).toMatchObject({ ok: false });
        expect(checkPrompt('  una   foto \n di un\tmare ')).toEqual({ ok: true, prompt: 'una foto di un mare' });
    });
});

describe('isSafeRemoteUrl', () => {
    it('accetta https verso domini veri', () => expect(isSafeRemoteUrl('https://cdn.magnific.com/x/a.png?sig=1')).toBe(true));
    it('rifiuta http, indirizzi numerici, reti interne e credenziali', () => {
        for (const u of ['http://cdn.x.com/a.png', 'https://127.0.0.1/a.png', 'https://10.0.0.5/a', 'https://localhost/a', 'https://[::1]/a', 'https://db.internal/a', 'https://printer.local/a', 'https://u:p@cdn.x.com/a', 'https://intranet/a', 'non un url'])
            expect(isSafeRemoteUrl(u)).toBe(false);
    });
});

describe('tetto giornaliero', () => {
    it('conta fino al tetto e poi si ferma', () => {
        expect(nextCount(0, 25)).toBe(1);
        expect(nextCount(24, 25)).toBe(25);
        expect(nextCount(25, 25)).toBeNull();
    });
    it('legge il tetto dalla configurazione, con un valore di partenza', () => {
        expect(parseLimit(undefined)).toBe(25);
        expect(parseLimit('40')).toBe(40);
        expect(parseLimit('-3')).toBe(25);
        expect(parseLimit('99999')).toBe(1000);
    });
    it('un conteggio per utente e per giorno', () => expect(usageKey('u1', new Date('2026-10-23T22:30:00Z'))).toBe('u1_2026-10-23'));
});

describe('messaggi ed estensioni', () => {
    it('errori HTTP in italiano', () => {
        expect(describeHttpError(401)).toMatch(/MAGNIFIC_API_KEY/);
        expect(describeHttpError(402)).toMatch(/Crediti/);
        expect(describeHttpError(429)).toMatch(/Troppe richieste/);
        expect(describeHttpError(500)).toMatch(/non risponde/);
    });
    it('estensione dal tipo del file', () => {
        expect(extensionFor('image/png')).toBe('png');
        expect(extensionFor('image/webp')).toBe('webp');
        expect(extensionFor('image/jpeg')).toBe('jpg');
    });
});
