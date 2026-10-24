import { describe, it, expect } from 'vitest';
import { deepLink, linkIsValid, newLinkCode, parseCommand, safeEqual, webhookSecret } from '../telegram-link';

describe('parseCommand', () => {
    it('/start con codice, senza codice, con @bot', () => {
        expect(parseCommand('/start abcdef0123456789abcdef01')).toEqual({ kind: 'start', code: 'abcdef0123456789abcdef01' });
        expect(parseCommand('/start')).toEqual({ kind: 'start', code: undefined });
        expect(parseCommand('/start@MioBot abcdef0123456789abcdef01')).toEqual({ kind: 'start', code: 'abcdef0123456789abcdef01' });
    });
    it('/stop e /scollega', () => {
        expect(parseCommand('/stop')).toEqual({ kind: 'stop' });
        expect(parseCommand('/Scollega')).toEqual({ kind: 'stop' });
    });
    it('il resto è «altro»; un codice troppo corto o con simboli non vale', () => {
        expect(parseCommand('ciao')).toEqual({ kind: 'other' });
        expect(parseCommand(undefined)).toEqual({ kind: 'other' });
        expect(parseCommand('/start abc')).toEqual({ kind: 'other' });
        expect(parseCommand('/start abcdef0123456789;DROP')).toEqual({ kind: 'other' });
    });
});

describe('codice di collegamento', () => {
    it('è casuale e lungo abbastanza', () => {
        const a = newLinkCode(), b = newLinkCode();
        expect(a).not.toBe(b);
        expect(a).toMatch(/^[0-9a-f]{24}$/);
    });
    it('vale solo se uguale e non scaduto', () => {
        const now = 1_000_000;
        expect(linkIsValid({ code: 'abc', expiresAt: now + 1000 }, 'abc', now)).toBe(true);
        expect(linkIsValid({ code: 'abc', expiresAt: now - 1 }, 'abc', now)).toBe(false);
        expect(linkIsValid({ code: 'abc', expiresAt: now + 1000 }, 'abd', now)).toBe(false);
        expect(linkIsValid(undefined, 'abc', now)).toBe(false);
        expect(linkIsValid({ code: 'abc' }, 'abc', now)).toBe(false);
    });
    it('link diretto al bot', () => expect(deepLink('MioBot', 'xyz')).toBe('https://t.me/MioBot?start=xyz'));
});

describe('segreto del webhook', () => {
    it('è stabile per lo stesso token, diverso fra token, e non contiene il token', () => {
        const t = '123456789:AAEhBP0av18ZZZZZZZZZZZZZZZZZZZZZZZZ';
        expect(webhookSecret(t)).toBe(webhookSecret(t));
        expect(webhookSecret(t)).not.toBe(webhookSecret(t + 'x'));
        expect(webhookSecret(t)).toMatch(/^[0-9a-f]{64}$/);
        expect(webhookSecret(t)).not.toContain('AAEh');
    });
    it('safeEqual: mancante o diverso = no', () => {
        expect(safeEqual('a', 'a')).toBe(true);
        expect(safeEqual('a', 'b')).toBe(false);
        expect(safeEqual(null, 'a')).toBe(false);
        expect(safeEqual('aa', 'a')).toBe(false);
    });
});
