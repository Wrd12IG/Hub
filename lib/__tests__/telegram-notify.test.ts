import { describe, it, expect, vi, beforeEach } from 'vitest';

const TOKEN = '123456789:AAEhBP0av18ZZZZZZZZZZZZZZZZZZZZZZZZ';
let cfg: any = {};
vi.mock('@/lib/firebase-admin', () => ({ adminDb: { collection: () => ({ doc: () => ({ get: async () => { if (cfg === 'boom') throw new Error('db'); return { data: () => cfg }; } }) }) } }));
const calls: { fn: string; args: any[] }[] = [];
let failSend = false;
vi.mock('@/lib/telegram', async (orig) => {
    const real = await orig<typeof import('@/lib/telegram')>();
    return {
        ...real,
        sendMessage: vi.fn(async (...a: any[]) => { if (failSend) throw new Error('Telegram: Forbidden'); calls.push({ fn: 'sendMessage', args: a }); }),
        sendPhoto: vi.fn(async (...a: any[]) => { if (failSend) throw new Error('Telegram: Forbidden'); calls.push({ fn: 'sendPhoto', args: a }); }),
    };
});
import { companyChatId, notifyCompany } from '@/lib/telegram-notify';

beforeEach(() => { process.env.TELEGRAM_BOT_TOKEN = TOKEN; cfg = { companyChatId: '777' }; calls.length = 0; failSend = false; });

describe('notifyCompany', () => {
    it('manda un messaggio alla chat del telefono aziendale', async () => {
        expect(await notifyCompany({ html: 'ciao' })).toEqual({ sent: true });
        expect(calls[0].fn).toBe('sendMessage');
        expect(calls[0].args.slice(0, 2)).toEqual(['777', 'ciao']);
    });
    it('con un\'immagine manda la foto con la didascalia e il pulsante', async () => {
        await notifyCompany({ html: 'Storia', photoUrl: 'https://x/y.jpg', button: { label: 'Apri', url: 'https://hub' } });
        expect(calls[0].fn).toBe('sendPhoto');
        expect(calls[0].args[1]).toBe('https://x/y.jpg');
        expect(calls[0].args[3]).toEqual({ button: { label: 'Apri', url: 'https://hub' } });
    });
    it('senza telefono collegato, senza token o con Telegram che rifiuta: non lancia, spiega perché', async () => {
        cfg = {};
        expect(await notifyCompany({ html: 'x' })).toEqual({ sent: false, reason: 'Il telefono aziendale non è collegato' });
        cfg = { companyChatId: '777' }; delete process.env.TELEGRAM_BOT_TOKEN;
        expect(await notifyCompany({ html: 'x' })).toMatchObject({ sent: false });
        process.env.TELEGRAM_BOT_TOKEN = TOKEN; failSend = true;
        expect(await notifyCompany({ html: 'x' })).toEqual({ sent: false, reason: 'Telegram: Forbidden' });
    });
    it('un errore del database non fa lanciare: nessun destinatario', async () => {
        cfg = 'boom';
        expect(await companyChatId()).toBeNull();
    });
});
