/**
 * lib/telegram-link.ts
 *
 * Collegamento fra un utente del Hub e la sua chat Telegram, senza che nessuno debba cercare ID: il Hub genera un codice
 * monouso, l'utente apre il link del bot (t.me/<bot>?start=<codice>) e il bot, ricevuto il codice, salva la chat.
 * Funzioni pure (più il segreto del webhook, derivato dal token: niente variabile in più da gestire).
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const LINK_TTL_MS = 15 * 60 * 1000;
/** Indirizzo pubblico del Hub, dove Telegram manda i messaggi ricevuti dal bot. */
export const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL || 'https://hub.wrdigital.it';

export const newLinkCode = () => randomBytes(12).toString('hex');

export const deepLink = (botUsername: string, code: string) => `https://t.me/${botUsername}?start=${code}`;

export function webhookSecret(token: string): string {
    return createHmac('sha256', token).update('hub-telegram-webhook').digest('hex');
}

export function safeEqual(a: string | null | undefined, b: string): boolean {
    if (!a) return false;
    const x = Buffer.from(a), y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
}

export type Command = { kind: 'start'; code?: string } | { kind: 'stop' } | { kind: 'other' };

export function parseCommand(text: unknown): Command {
    const t = typeof text === 'string' ? text.trim() : '';
    const start = /^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{8,64}))?$/.exec(t);
    if (start) return { kind: 'start', code: start[1] };
    if (/^\/(?:stop|scollega)(?:@\w+)?$/i.test(t)) return { kind: 'stop' };
    return { kind: 'other' };
}

export function linkIsValid(link: { code?: string; expiresAt?: number } | null | undefined, code: string, now: number): boolean {
    return !!link?.code && typeof link.expiresAt === 'number' && link.expiresAt > now && safeEqual(link.code, code);
}
