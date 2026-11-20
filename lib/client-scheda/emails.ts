/**
 * lib/client-scheda/emails.ts
 *
 * Testo delle email (oggetto + HTML). Pure. Tutto il testo libero viene «escaped»; nessun dato sensibile: solo ciò che sta nella riga e il nome
 * del cliente. Non partono mai verso i clienti.
 */
import { LOG_TYPE_LABEL, type LogEntry } from './types';

export const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();
const when = (iso: string) => new Date(iso).toLocaleString('it-IT', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Rome' });

const shell = (banner: string, bannerColor: string, body: string, link: string) => `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#18181b">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:${bannerColor};color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-size:16px;font-weight:bold">${banner}</div>
<div style="background:#fff;padding:18px;border-radius:0 0 10px 10px;line-height:1.5;font-size:14px">${body}
<p style="margin:22px 0 4px"><a href="${escapeHtml(link)}" style="background:#18181b;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block">Apri la scheda</a></p>
</div></div></body></html>`;

type Entry = Pick<LogEntry, 'createdAt' | 'authorName' | 'type' | 'text'>;

export function buildRequestEmail(p: { clientName: string; entry: Entry; link: string }): { subject: string; html: string } {
    const { clientName, entry, link } = p;
    const body = `<p style="margin:0 0 12px"><b>Serve la tua approvazione</b> su una richiesta registrata nella scheda di <b>${escapeHtml(clientName)}</b>.</p>
<p style="margin:0 0 4px;color:#52525b">${escapeHtml(entry.authorName)} · ${escapeHtml(LOG_TYPE_LABEL[entry.type])} · ${escapeHtml(when(entry.createdAt))}</p>
<blockquote style="margin:8px 0;padding:10px 14px;background:#f4f4f5;border-left:4px solid #f59e0b;white-space:pre-wrap">${escapeHtml(entry.text)}</blockquote>`;
    return { subject: `[DA APPROVARE] ${oneLine(clientName)} — ${LOG_TYPE_LABEL[entry.type]}`, html: shell('⚠️ Richiesta da approvare', '#d97706', body, link) };
}

export function buildDecisionEmail(p: { clientName: string; entry: Entry; decision: 'approvata' | 'rifiutata'; deciderName: string; comment: string | null; link: string }): { subject: string; html: string } {
    const { clientName, entry, decision, deciderName, comment, link } = p;
    const ok = decision === 'approvata';
    const body = `<p style="margin:0 0 12px">La tua richiesta su <b>${escapeHtml(clientName)}</b> è stata <b>${ok ? 'approvata' : 'rifiutata'}</b> da ${escapeHtml(deciderName)}.</p>
${comment ? `<p style="margin:0 0 8px"><b>Commento:</b> ${escapeHtml(comment)}</p>` : ''}
<blockquote style="margin:8px 0;padding:10px 14px;background:#f4f4f5;border-left:4px solid ${ok ? '#16a34a' : '#dc2626'};white-space:pre-wrap">${escapeHtml(entry.text)}</blockquote>`;
    return {
        subject: `[${ok ? 'APPROVATA' : 'RIFIUTATA'}] ${oneLine(clientName)} — ${LOG_TYPE_LABEL[entry.type]}`,
        html: shell(ok ? '✅ Richiesta approvata' : '❌ Richiesta rifiutata', ok ? '#16a34a' : '#dc2626', body, link),
    };
}
