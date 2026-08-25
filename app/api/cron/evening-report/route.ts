/**
 * GET /api/cron/evening-report
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Report serale automatico degli operatori
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Viene eseguito ogni sera alle 18:00 (CEST) = 16:00 UTC
 * tramite Vercel Cron (configurato in vercel.json).
 *
 * SICUREZZA:
 *   La route è protetta da CRON_SECRET nell'header "x-cron-secret".
 *
 * FLUSSO:
 *   1. Verifica il segreto
 *   2. Costruisce il report per ogni operatore attivo (esclusi Valentina, Roberto, Beppe)
 *   3. Genera l'HTML dell'email
 *   4. Invia via Brevo SMTP a info@wrdigital.it
 *   5. Restituisce un JSON con il risultato
 *
 * TESTING LOCALE:
 *   curl -X GET "http://localhost:9002/api/cron/evening-report" \
 *        -H "x-cron-secret: IL_TUO_CRON_SECRET"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildEveningReport, buildEveningReportHtml } from '@/lib/evening-report';
import nodemailer from 'nodemailer';

// ─── Configurazione ───────────────────────────────────────────────────────────

const RECIPIENT_EMAIL =
  process.env.EVENING_REPORT_RECIPIENT_EMAIL || 'info@wrdigital.it';
const RECIPIENT_NAME = 'W[r]Digital';

// ─── Invio email SMTP ────────────────────────────────────────────────────────

async function sendReportEmail(
  subject: string,
  htmlContent: string
): Promise<{ success: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.BREVO_API_KEY;

  if (!host || !user || !pass) {
    console.warn(
      '[evening-report] SMTP non configurato. Imposta SMTP_HOST, SMTP_USER, SMTP_PASS in .env.local'
    );
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: false, // STARTTLS su porta 587
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: `"W[r]Digital HUB" <${user}>`,
      to: `"${RECIPIENT_NAME}" <${RECIPIENT_EMAIL}>`,
      subject,
      html: htmlContent,
    });

    console.log('[evening-report] Email inviata:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('[evening-report] Errore invio email:', error);
    return { success: false, error: String(error) };
  }
}

// ─── Handler principale ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── Step 1: Verifica il segreto ──────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const requestSecret = request.headers.get('x-cron-secret');

  const host = request.headers.get('host') || '';
  const isLocalhost =
    host.startsWith('localhost') || host.startsWith('127.0.0.1');

  if (cronSecret && requestSecret !== cronSecret) {
    console.warn('[evening-report] Accesso non autorizzato da:', host);
    return NextResponse.json(
      { error: "Unauthorized. Aggiungi l'header x-cron-secret." },
      { status: 401 }
    );
  }

  if (!cronSecret && !isLocalhost) {
    return NextResponse.json(
      { error: 'Unauthorized. Configura CRON_SECRET nelle variabili ENV.' },
      { status: 401 }
    );
  }

  // ── Step 2: Costruisce il report ─────────────────────────────────────────
  console.log('[evening-report] Avvio raccolta dati...');

  const { searchParams } = new URL(request.url);
  const isYesterday = searchParams.get('yesterday') === 'true';
  const customDateParam = searchParams.get('date'); // YYYY-MM-DD
  
  let targetDate: Date | undefined;
  if (customDateParam) {
    targetDate = new Date(customDateParam);
  } else if (isYesterday) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    targetDate = d;
  }

  let report;
  try {
    report = await buildEveningReport(targetDate);
  } catch (error) {
    console.error('[evening-report] Errore costruzione report:', error);
    return NextResponse.json(
      { error: 'Failed to build report', details: String(error) },
      { status: 500 }
    );
  }

  console.log(
    `[evening-report] Dati raccolti: ${report.users.length} operatori, ` +
    `${report.users.reduce((s, u) => s + u.overdueCount, 0)} task scaduti`
  );

  // ── Step 3: Costruisce l'HTML ─────────────────────────────────────────────
  const htmlContent = buildEveningReportHtml(report);

  // Soggetto con informazioni rilevanti
  const totalOverdue = report.users.reduce((s, u) => s + u.overdueCount, 0);
  const subject =
    totalOverdue > 0
      ? `📊 Report Serale — ${totalOverdue} task scadut${totalOverdue === 1 ? 'o' : 'i'} — ${report.date}`
      : `📊 Report Serale Operatori — ${report.date}`;

  // ── Step 4: Invia l'email ─────────────────────────────────────────────────
  const emailResult = await sendReportEmail(subject, htmlContent);

  // ── Risposta finale ───────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    sentAt: new Date().toISOString(),
    summary: {
      date: report.date,
      weekLabel: report.weekLabel,
      usersCount: report.users.length,
      totalOverdue,
      usersDetail: report.users.map((u) => ({
        name: u.userName,
        todayActivities: u.todayActivities.length,
        todayTotalSeconds: u.todayTotalSeconds,
        overdueCount: u.overdueCount,
      })),
    },
    email: {
      sent: emailResult.success,
      recipient: RECIPIENT_EMAIL,
      subject,
      error: emailResult.error,
    },
  });
}
