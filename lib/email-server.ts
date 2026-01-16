'use server';

import nodemailer from 'nodemailer';

/**
 * Send email via SMTP (Brevo) using Nodemailer
 * This keeps credentials secure on the server
 */
export async function sendEmailServerAction(
    toEmail: string,
    toName: string,
    subject: string,
    htmlContent: string,
    senderName: string,
    senderEmail: string
): Promise<{ success: boolean; error?: string }> {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS || process.env.BREVO_API_KEY; // Fallback to API key if set

    if (!host || !user || !pass) {
        console.error('SMTP configuration missing');
        return { success: false, error: 'Configuration error: Missing SMTP details' };
    }

    try {
        // Create reusable transporter object using the default SMTP transport
        const transporter = nodemailer.createTransport({
            host: host,
            port: port,
            secure: false, // true for 465, false for other ports
            auth: {
                user: user,
                pass: pass,
            },
        });

        // Send mail with defined transport object
        const info = await transporter.sendMail({
            from: `"${senderName}" <${senderEmail}>`, // sender address
            to: `"${toName}" <${toEmail}>`, // list of receivers
            subject: subject, // Subject line
            html: htmlContent, // html body
        });

        console.log('Message sent: %s', info.messageId);
        return { success: true };
    } catch (error) {
        console.error('Server action error sending email (Nodemailer):', error);
        return { success: false, error: String(error) };
    }
}
