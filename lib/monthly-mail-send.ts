import nodemailer from 'nodemailer';

/**
 * Invio della mail mensile via SMTP (la stessa casella che usa il digest quotidiano). Una sola mail a più destinatari.
 * Il mittente è `MONTHLY_MAIL_FROM` se impostato, altrimenti la casella SMTP: un indirizzo non verificato presso il
 * provider verrebbe rifiutato, quindi si cambia solo dopo averlo verificato lì. Le risposte vanno a roberto@wrdigital.it.
 */
export async function sendMonthlyMail(opts: { to: string[]; subject: string; html: string; text: string }): Promise<{ success: boolean; error?: string }> {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS || process.env.BREVO_API_KEY;
    if (!host || !user || !pass) return { success: false, error: 'SMTP non configurato' };
    if (opts.to.length === 0) return { success: false, error: 'Nessun destinatario' };
    try {
        const transporter = nodemailer.createTransport({ host, port, secure: false, auth: { user, pass } });
        await transporter.sendMail({
            from: `"W[r]Digital HUB" <${process.env.MONTHLY_MAIL_FROM || user}>`,
            replyTo: 'roberto@wrdigital.it',
            to: opts.to.join(', '),
            subject: opts.subject,
            html: opts.html,
            text: opts.text,
        });
        return { success: true };
    } catch (e: any) {
        console.error('[monthly-mail] invio fallito:', e?.message);
        return { success: false, error: String(e?.message ?? e) };
    }
}
