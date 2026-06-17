/**
 * GET /api/cron/daily-digest
 * 
 * ─────────────────────────────────────────────────────────────────────────────
 * COME FUNZIONA — Spiegazione per chi sta imparando
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Questa route viene chiamata automaticamente ogni mattina alle 08:00
 * da Vercel Cron (configurato in vercel.json) oppure manualmente per test.
 * 
 * SICUREZZA:
 *   La route è protetta da un "segreto" (CRON_SECRET) nell'header.
 *   Senza il segreto corretto → risponde 401 Unauthorized.
 *   Questo impedisce a chiunque di triggerare il digest chiamando l'URL.
 * 
 * FLUSSO:
 *   1. Verifica il segreto → se sbagliato, blocca
 *   2. Chiama buildDailyDigest() → query Firestore
 *   3. Costruisce l'HTML dell'email
 *   4. Invia via Brevo SMTP
 *   5. Restituisce un JSON con il risultato
 * 
 * TESTING LOCALE:
 *   curl -X GET "http://localhost:9002/api/cron/daily-digest" \
 *        -H "x-cron-secret: IL_TUO_CRON_SECRET"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildDailyDigest, buildDigestEmailHtml } from '@/lib/daily-digest';
import nodemailer from 'nodemailer';

// ─── Configurazione ───────────────────────────────────────────────────────────

// L'email destinataria del digest (puoi metterla come env var)
const DIGEST_RECIPIENT_EMAIL = process.env.DIGEST_RECIPIENT_EMAIL || process.env.SMTP_USER || '';
const DIGEST_RECIPIENT_NAME = process.env.DIGEST_RECIPIENT_NAME || 'W[r]Digital Team';

// ─── Funzione per inviare email via Brevo SMTP ────────────────────────────────

/**
 * Invia l'email digest tramite SMTP Brevo.
 * 
 * Brevo funziona come qualsiasi server SMTP:
 *   - Host: smtp-relay.brevo.com
 *   - Porta: 587
 *   - User + Password: dalle env vars
 */
async function sendDigestEmail(subject: string, htmlContent: string): Promise<{ success: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.BREVO_API_KEY;

  // Se manca la configurazione SMTP → logga ma non bloccare (utile in dev)
  if (!host || !user || !pass) {
    console.warn('[daily-digest] SMTP non configurato. Email non inviata. Configura SMTP_HOST, SMTP_USER, SMTP_PASS in .env.local');
    return { success: false, error: 'SMTP not configured' };
  }

  if (!DIGEST_RECIPIENT_EMAIL) {
    console.warn('[daily-digest] DIGEST_RECIPIENT_EMAIL non impostato. Imposta la variabile env.');
    return { success: false, error: 'No recipient configured' };
  }

  try {
    // Crea il "transporter" — è il client che parla con il server SMTP
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,   // false per porta 587 (STARTTLS)
      auth: { user, pass },
    });

    // Invia l'email
    const info = await transporter.sendMail({
      from: `"W[r]Digital HUB" <${user}>`,
      to: `"${DIGEST_RECIPIENT_NAME}" <${DIGEST_RECIPIENT_EMAIL}>`,
      subject,
      html: htmlContent,
    });

    console.log('[daily-digest] Email inviata:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('[daily-digest] Errore invio email:', error);
    return { success: false, error: String(error) };
  }
}

// ─── Handler principale ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── Step 1: Verifica il segreto ──────────────────────────────────────────
  //
  // Il segreto viene passato come header HTTP: "x-cron-secret: xxxx"
  // In questo modo nessuno può chiamare questo endpoint dall'esterno
  // senza conoscere il valore di CRON_SECRET.
  //
  const cronSecret = process.env.CRON_SECRET;
  const requestSecret = request.headers.get('x-cron-secret');

  // Modalità bypass: se CRON_SECRET non è configurato, permettiamo chiamate
  // solo da localhost (utile in sviluppo locale)
  const host = request.headers.get('host') || '';
  const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');

  if (cronSecret && requestSecret !== cronSecret) {
    // Il segreto c'è ma non corrisponde → blocca
    console.warn('[daily-digest] Accesso non autorizzato tentato da:', host);
    return NextResponse.json(
      { error: 'Unauthorized. Aggiungi l\'header x-cron-secret.' },
      { status: 401 }
    );
  }

  if (!cronSecret && !isLocalhost) {
    // Nessun segreto configurato e non siamo in locale → blocca per sicurezza
    return NextResponse.json(
      { error: 'Unauthorized. Configura CRON_SECRET nelle variabili ENV.' },
      { status: 401 }
    );
  }

  // ── Step 2: Raccoglie i dati da Firestore ────────────────────────────────
  // daily-digest: raccolta dati Firestore
  
  let digest;
  try {
    digest = await buildDailyDigest();
  } catch (error) {
    console.error('[daily-digest] Errore nella raccolta dati:', error);
    return NextResponse.json(
      { error: 'Failed to build digest', details: String(error) },
      { status: 500 }
    );
  }

  console.log(`[daily-digest] Dati raccolti:
    - Completati ieri: ${digest.completedYesterday.length}
    - Scadono oggi: ${digest.dueTodayPending.length}
    - Scaduti: ${digest.overdue.length}
    - In approvazione: ${digest.inApproval.length}
  `);

  // ── Step 3: Costruisce l'HTML dell'email ─────────────────────────────────
  const htmlContent = buildDigestEmailHtml(digest);

  // Costruiamo anche il subject con i dati reali
  const totalProblems = digest.overdue.length + digest.inApproval.length;
  const subject = totalProblems > 0
    ? `⚠️ ${totalProblems} azioni richieste — Daily Digest ${digest.date}`
    : `✅ Tutto in ordine — Daily Digest ${digest.date}`;

  // ── Step 4: Invia l'email ─────────────────────────────────────────────────
  const emailResult = await sendDigestEmail(subject, htmlContent);

  // ── Risposta finale ───────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    sentAt: new Date().toISOString(),
    summary: {
      date: digest.date,
      completedYesterday: digest.completedYesterday.length,
      dueTodayPending: digest.dueTodayPending.length,
      overdue: digest.overdue.length,
      inApproval: digest.inApproval.length,
    },
    email: {
      sent: emailResult.success,
      recipient: DIGEST_RECIPIENT_EMAIL || '(non configurato)',
      subject,
      error: emailResult.error,
    },
  });
}
