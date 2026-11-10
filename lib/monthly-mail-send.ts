import nodemailer from 'nodemailer';
import { adminDb } from '@/lib/firebase-admin';
import { resolveSender } from '@/lib/monthly-mail-settings';

/**
 * Invio della mail mensile via SMTP (lo stesso server delle notifiche del Hub). Una sola mail a più destinatari.
 *
 * Il mittente è quello delle notifiche (`hub@wrdigital.it`, vedi `resolveSender`): è l'unico che il provider riconosce, e le
 * notifiche arrivano per questo. Un mittente non validato viene accettato dal server SMTP e poi scartato in silenzio, quindi
 * non basta «invio riuscito» per dire che la mail arriva: per questo si registra la risposta del server (id messaggio,
 * destinatari accettati e rifiutati) e un rifiuto è un errore. Le risposte vanno a roberto@wrdigital.it.
 */
export async function sendMonthlyMail(opts: { to: string[]; subject: string; html: string; text: string }): Promise<{ success: boolean; error?: string; from?: string; messageId?: string }> {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS || process.env.BREVO_API_KEY;
    if (!host || !user || !pass) return { success: false, error: 'SMTP non configurato' };
    if (opts.to.length === 0) return { success: false, error: 'Nessun destinatario' };
    try {
        const notif = await adminDb.collection('settings').doc('notifications').get().then((s) => (s.exists ? s.data() : undefined)).catch(() => undefined);
        const sender = resolveSender(process.env.MONTHLY_MAIL_FROM, notif);

        const transporter = nodemailer.createTransport({ host, port, secure: false, auth: { user, pass } });
        const info = await transporter.sendMail({
            from: `"${sender.name}" <${sender.address}>`,
            replyTo: 'roberto@wrdigital.it',
            to: opts.to.join(', '),
            subject: opts.subject,
            html: opts.html,
            text: opts.text,
        });
        const rejected = (info.rejected ?? []).map(String);
        console.log(`[monthly-mail] inviata da ${sender.address} id=${info.messageId} accettati=${(info.accepted ?? []).length} rifiutati=${rejected.length} risposta="${String(info.response ?? '').slice(0, 120)}"`);
        if (rejected.length) return { success: false, error: `Destinatari rifiutati dal server: ${rejected.join(', ')}`, from: sender.address };
        return { success: true, from: sender.address, messageId: info.messageId };
    } catch (e: any) {
        console.error('[monthly-mail] invio fallito:', e?.message);
        return { success: false, error: String(e?.message ?? e) };
    }
}
