/**
 * lib/telegram.ts
 *
 * Client minimo dell'API dei bot di Telegram (https://core.telegram.org/bots/api). Solo server.
 * Il token (TELEGRAM_BOT_TOKEN) sta nelle variabili di Vercel: mai nel codice, mai nei log, mai nei messaggi d'errore.
 */

const API = 'https://api.telegram.org';

export function telegramToken(): string | null {
    const t = process.env.TELEGRAM_BOT_TOKEN;
    return t && /^\d{5,}:[A-Za-z0-9_-]{20,}$/.test(t.trim()) ? t.trim() : null;
}

export const isTelegramConfigured = () => telegramToken() !== null;

export class TelegramError extends Error {}

async function call<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    const token = telegramToken();
    if (!token) throw new TelegramError('Telegram non è configurato: manca TELEGRAM_BOT_TOKEN.');
    let res: Response;
    try {
        res = await fetch(`${API}/bot${token}/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body ?? {}),
            signal: AbortSignal.timeout(10_000),
            cache: 'no-store',
        });
    } catch {
        // Il messaggio di rete originale può contenere l'indirizzo con il token: non lo si propaga
        throw new TelegramError('Telegram non raggiungibile.');
    }
    const json = await res.json().catch(() => null) as { ok?: boolean; result?: T; description?: string } | null;
    if (!json?.ok) throw new TelegramError(`Telegram: ${json?.description || `errore ${res.status}`}`);
    return json.result as T;
}

export const getMe = () => call<{ id: number; username: string; first_name: string }>('getMe');
export const getWebhookInfo = () => call<{ url: string; last_error_message?: string }>('getWebhookInfo');
export const setWebhook = (url: string, secret: string) =>
    call<true>('setWebhook', { url, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: true });

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export interface SendOptions {
    /** Pulsante sotto il messaggio (apre un indirizzo). */
    button?: { label: string; url: string };
}

const markup = (o?: SendOptions) => (o?.button ? { reply_markup: { inline_keyboard: [[{ text: o.button.label, url: o.button.url }]] } } : {});

/** `html` è già HTML di Telegram (usare escapeHtml sul testo dell'utente). Limite Telegram: 4096 caratteri. */
export const sendMessage = (chatId: string | number, html: string, o?: SendOptions) =>
    call('sendMessage', { chat_id: chatId, text: clip(html, 4096), parse_mode: 'HTML', link_preview_options: { is_disabled: true }, ...markup(o) });

/** Foto da un indirizzo https pubblico, con didascalia (limite Telegram: 1024 caratteri). */
export const sendPhoto = (chatId: string | number, photoUrl: string, captionHtml: string, o?: SendOptions) =>
    call('sendPhoto', { chat_id: chatId, photo: photoUrl, caption: clip(captionHtml, 1024), parse_mode: 'HTML', ...markup(o) });
