/**
 * lib/telegram-notify.ts
 *
 * Avvisi comuni su Telegram: vanno alla chat del «telefono aziendale», un destinatario unico per tutti i clienti
 * (config/telegram.companyChatId, impostato da un amministratore). Un errore qui non deve mai far fallire l'azione che
 * l'ha generato: restituisce l'esito, non lancia.
 */
import { adminDb } from '@/lib/firebase-admin';
import { isTelegramConfigured, sendMessage, sendPhoto, type SendOptions } from '@/lib/telegram';

export async function companyChatId(): Promise<string | null> {
    try {
        const id = (await adminDb.collection('config').doc('telegram').get()).data()?.companyChatId;
        return typeof id === 'string' && id ? id : null;
    } catch {
        return null;
    }
}

export type NotifyResult = { sent: true } | { sent: false; reason: string };

export async function notifyCompany(args: { html: string; photoUrl?: string } & SendOptions): Promise<NotifyResult> {
    if (!isTelegramConfigured()) return { sent: false, reason: 'Telegram non è configurato' };
    const chat = await companyChatId();
    if (!chat) return { sent: false, reason: 'Il telefono aziendale non è collegato' };
    try {
        if (args.photoUrl) await sendPhoto(chat, args.photoUrl, args.html, { button: args.button });
        else await sendMessage(chat, args.html, { button: args.button });
        return { sent: true };
    } catch (e) {
        return { sent: false, reason: (e as Error)?.message || 'invio non riuscito' };
    }
}
