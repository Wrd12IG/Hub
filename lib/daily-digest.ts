/**
 * ─────────────────────────────────────────────────────────────────────────────
 * DAILY DIGEST — Come funziona
 * ─────────────────────────────────────────────────────────────────────────────
 * 
 * Questo file viene chiamato da:
 *   GET /api/cron/daily-digest
 * 
 * Lo scopo è:
 *   1. Leggere da Firestore i task rilevanti per oggi
 *   2. Costruire un'email riepilogativa
 *   3. Inviarla via Brevo (SMTP)
 * 
 * Viene eseguito ogni mattina alle 08:00 tramite Vercel Cron.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { adminDb } from '@/lib/firebase-admin';
import type { Task } from '@/lib/data';

// ─── Tipi utili per il digest ─────────────────────────────────────────────────

export interface DigestTask {
  id: string;
  title: string;
  clientId: string;
  priority: string;
  dueDate?: string;
  status: string;
}

export interface DigestSummary {
  date: string;                    // "04/05/2026"
  completedYesterday: DigestTask[]; // Task approvati ieri
  dueTodayPending: DigestTask[];   // Task in scadenza oggi, non ancora approvati
  overdue: DigestTask[];           // Task scaduti e non approvati
  inApproval: DigestTask[];        // Task in attesa di approvazione
}

// ─── Funzioni di utilità per le date ─────────────────────────────────────────

/**
 * Restituisce l'inizio e la fine di "ieri" in ISO string.
 * 
 * Esempio: se oggi è 2026-05-04
 *   startOfYesterday → "2026-05-03T00:00:00.000Z"
 *   endOfYesterday   → "2026-05-03T23:59:59.999Z"
 */
function getYesterdayRange(): { start: string; end: string } {
  const now = new Date();
  
  // Inizio di ieri: mezzanotte di due giorni fa
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(0, 0, 0, 0);
  
  // Fine di ieri: un millisecondo prima della mezzanotte di oggi
  const end = new Date(now);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);
  
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Restituisce l'inizio e la fine di "oggi" in ISO string.
 */
function getTodayRange(): { start: string; end: string } {
  const now = new Date();
  
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  
  return { start: start.toISOString(), end: end.toISOString() };
}

// ─── Query Firestore ───────────────────────────────────────────────────────────

/**
 * QUERY 1: Task approvati IERI.
 * 
 * In Firestore leggiamo la collezione "tasks" e filtriamo:
 *   - status == "Approvato"
 *   - updatedAt >= inizio di ieri
 *   - updatedAt <= fine di ieri
 * 
 * Nota: per questo filtro su updatedAt, Firestore richiede un indice composto.
 * Se non esiste, la query darà errore e ti dirà di crearlo nella console Firebase.
 */
async function getCompletedYesterday(): Promise<DigestTask[]> {
  const { start, end } = getYesterdayRange();
  
  try {
    const snapshot = await adminDb
      .collection('tasks')
      .where('status', '==', 'Approvato')
      .where('updatedAt', '>=', start)
      .where('updatedAt', '<=', end)
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Omit<DigestTask, 'id'>,
    }));
  } catch (error) {
    // Se l'indice Firestore non esiste ancora, restituisce array vuoto
    // invece di far crashare tutto il digest
    console.warn('[daily-digest] getCompletedYesterday error (indice mancante?):', error);
    return [];
  }
}

/**
 * QUERY 2: Task in scadenza OGGI, non ancora approvati.
 * 
 * Firestore non supporta filtri su date come "between" su un campo string,
 * quindi filtriamo per dueDate >= oggi-inizio e dueDate <= oggi-fine.
 * 
 * Poi escludiamo i task già "Approvato" o "Annullato" in JavaScript
 * (non possiamo fare .where('status', '!=', 'Approvato') e '!=', 'Annullato')
 * perché Firestore non supporta più di una != nella stessa query.
 */
async function getDueTodayPending(): Promise<DigestTask[]> {
  const { start, end } = getTodayRange();
  
  const excludedStatuses = new Set(['Approvato', 'Annullato']);
  
  try {
    const snapshot = await adminDb
      .collection('tasks')
      .where('dueDate', '>=', start)
      .where('dueDate', '<=', end)
      .orderBy('dueDate', 'asc')
      .limit(100)
      .get();
    
    // Filtriamo in JavaScript quelli già completati o annullati
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() as Omit<DigestTask, 'id'> }))
      .filter(task => !excludedStatuses.has(task.status));
  } catch (error) {
    console.warn('[daily-digest] getDueTodayPending error:', error);
    return [];
  }
}

/**
 * QUERY 3: Task SCADUTI e non approvati.
 * 
 * dueDate < oggi-inizio  → scadenza passata
 * status != 'Approvato'  → non ancora completati
 * status != 'Annullato'  → non annullati
 */
async function getOverdueTasks(): Promise<DigestTask[]> {
  const { start: todayStart } = getTodayRange();
  
  const excludedStatuses = new Set(['Approvato', 'Annullato']);
  
  try {
    const snapshot = await adminDb
      .collection('tasks')
      .where('dueDate', '<', todayStart)
      .orderBy('dueDate', 'asc')
      .limit(50)
      .get();
    
    return snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() as Omit<DigestTask, 'id'> }))
      .filter(task => !excludedStatuses.has(task.status));
  } catch (error) {
    console.warn('[daily-digest] getOverdueTasks error:', error);
    return [];
  }
}

/**
 * QUERY 4: Task IN ATTESA DI APPROVAZIONE.
 * 
 * Questi sono i task che qualcuno ha inviato per revisione
 * e che non sono ancora stati approvati/rifiutati.
 */
async function getInApprovalTasks(): Promise<DigestTask[]> {
  const approvalStatuses = ['In Approvazione', 'In Approvazione Cliente'];
  
  try {
    const snapshot = await adminDb
      .collection('tasks')
      .where('status', 'in', approvalStatuses)
      .orderBy('updatedAt', 'desc')
      .limit(30)
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as Omit<DigestTask, 'id'>,
    }));
  } catch (error) {
    console.warn('[daily-digest] getInApprovalTasks error:', error);
    return [];
  }
}

// ─── Funzione principale ───────────────────────────────────────────────────────

/**
 * Raccoglie tutti i dati necessari per il digest.
 * Esegue le 4 query in parallelo per velocità.
 */
export async function buildDailyDigest(): Promise<DigestSummary> {
  // Promise.all esegue tutte e 4 le query contemporaneamente
  // invece di aspettarne una alla volta (più veloce)
  const [
    completedYesterday,
    dueTodayPending,
    overdue,
    inApproval,
  ] = await Promise.all([
    getCompletedYesterday(),
    getDueTodayPending(),
    getOverdueTasks(),
    getInApprovalTasks(),
  ]);
  
  return {
    date: new Date().toLocaleDateString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
    completedYesterday,
    dueTodayPending,
    overdue,
    inApproval,
  };
}

// ─── Costruttore HTML email ───────────────────────────────────────────────────

/**
 * Priorità task → emoji e colore per l'email.
 */
function priorityBadge(priority: string): string {
  const map: Record<string, string> = {
    Critica: '🔴 Critica',
    Alta: '🟠 Alta',
    Media: '🟡 Media',
    Bassa: '🟢 Bassa',
  };
  return map[priority] || priority;
}

/**
 * Costruisce una riga di task per l'email.
 */
function taskRow(task: DigestTask): string {
  return `
    <tr>
      <td style="padding:8px 12px; border-bottom:1px solid #2a2a3a; color:#e2e8f0;">
        ${task.title}
      </td>
      <td style="padding:8px 12px; border-bottom:1px solid #2a2a3a; color:#94a3b8; font-size:12px;">
        ${priorityBadge(task.priority)}
      </td>
      <td style="padding:8px 12px; border-bottom:1px solid #2a2a3a; color:#64748b; font-size:12px;">
        ${task.dueDate ? new Date(task.dueDate).toLocaleDateString('it-IT') : '—'}
      </td>
    </tr>
  `;
}

/**
 * Costruisce una sezione della tabella email con un gruppo di task.
 */
function taskSection(title: string, emoji: string, tasks: DigestTask[], emptyMsg: string): string {
  return `
    <div style="margin-bottom:28px;">
      <h3 style="color:#f1f5f9; font-size:15px; margin:0 0 10px; font-weight:600;">
        ${emoji} ${title} (${tasks.length})
      </h3>
      ${tasks.length === 0
        ? `<p style="color:#475569; font-size:13px; font-style:italic; margin:0;">${emptyMsg}</p>`
        : `<table style="width:100%; border-collapse:collapse; background:#1a1a2e; border-radius:8px; overflow:hidden;">
            <thead>
              <tr style="background:#0f0f1a;">
                <th style="padding:8px 12px; text-align:left; color:#7c3aed; font-size:12px; font-weight:600;">TASK</th>
                <th style="padding:8px 12px; text-align:left; color:#7c3aed; font-size:12px; font-weight:600;">PRIORITÀ</th>
                <th style="padding:8px 12px; text-align:left; color:#7c3aed; font-size:12px; font-weight:600;">SCADENZA</th>
              </tr>
            </thead>
            <tbody>
              ${tasks.map(taskRow).join('')}
            </tbody>
          </table>`
      }
    </div>
  `;
}

/**
 * Genera l'HTML completo dell'email digest.
 * 
 * Il design segue lo stile dark/industrial del HUB.
 */
export function buildDigestEmailHtml(digest: DigestSummary): string {
  const appUrl = process.env.APP_BASE_URL || 'http://localhost:9002';
  
  const totalProblems = digest.overdue.length + digest.inApproval.length;
  const subject = totalProblems > 0
    ? `⚠️ ${totalProblems} azioni richieste — Daily Digest ${digest.date}`
    : `✅ Tutto in ordine — Daily Digest ${digest.date}`;
  
  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background:#0d0d1a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  
  <!-- Wrapper -->
  <table role="presentation" style="width:100%; max-width:600px; margin:0 auto; padding:24px 0;">
    <tr><td>
      
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%); border:1px solid #2a2a4a; border-radius:12px; padding:28px; margin-bottom:20px; text-align:center;">
        <p style="color:#7c3aed; font-size:11px; letter-spacing:3px; text-transform:uppercase; margin:0 0 8px;">W[r]Digital HUB</p>
        <h1 style="color:#f1f5f9; font-size:22px; margin:0 0 6px; font-weight:700;">Daily Digest</h1>
        <p style="color:#64748b; font-size:14px; margin:0; text-transform:capitalize;">${digest.date}</p>
      </div>
      
      <!-- Stats bar -->
      <div style="display:flex; gap:12px; margin-bottom:20px;">
        <table style="width:100%; border-collapse:separate; border-spacing:8px;">
          <tr>
            <td style="background:#0f2a1f; border:1px solid #166534; border-radius:8px; padding:14px; text-align:center; width:25%;">
              <div style="color:#22c55e; font-size:24px; font-weight:700;">${digest.completedYesterday.length}</div>
              <div style="color:#86efac; font-size:11px; margin-top:4px;">Completati ieri</div>
            </td>
            <td style="background:#1a1a2e; border:1px solid #2a2a4a; border-radius:8px; padding:14px; text-align:center; width:25%;">
              <div style="color:#f59e0b; font-size:24px; font-weight:700;">${digest.dueTodayPending.length}</div>
              <div style="color:#fcd34d; font-size:11px; margin-top:4px;">Scadono oggi</div>
            </td>
            <td style="background:${digest.overdue.length > 0 ? '#2a0f0f' : '#1a1a2e'}; border:1px solid ${digest.overdue.length > 0 ? '#7f1d1d' : '#2a2a4a'}; border-radius:8px; padding:14px; text-align:center; width:25%;">
              <div style="color:${digest.overdue.length > 0 ? '#ef4444' : '#64748b'}; font-size:24px; font-weight:700;">${digest.overdue.length}</div>
              <div style="color:${digest.overdue.length > 0 ? '#fca5a5' : '#475569'}; font-size:11px; margin-top:4px;">Scaduti</div>
            </td>
            <td style="background:${digest.inApproval.length > 0 ? '#1e0a3c' : '#1a1a2e'}; border:1px solid ${digest.inApproval.length > 0 ? '#4c1d95' : '#2a2a4a'}; border-radius:8px; padding:14px; text-align:center; width:25%;">
              <div style="color:${digest.inApproval.length > 0 ? '#a855f7' : '#64748b'}; font-size:24px; font-weight:700;">${digest.inApproval.length}</div>
              <div style="color:${digest.inApproval.length > 0 ? '#d8b4fe' : '#475569'}; font-size:11px; margin-top:4px;">In approvazione</div>
            </td>
          </tr>
        </table>
      </div>
      
      <!-- Sezioni task -->
      <div style="background:#1a1a2e; border:1px solid #2a2a4a; border-radius:12px; padding:24px; margin-bottom:20px;">
        
        ${taskSection('Completati ieri', '✅', digest.completedYesterday, 'Nessun task completato ieri.')}
        ${taskSection('Scadono oggi', '⏰', digest.dueTodayPending, 'Nessun task in scadenza oggi.')}
        ${taskSection('Scaduti — Azione richiesta', '🚨', digest.overdue, 'Nessun task scaduto. Ottimo lavoro!')}
        ${taskSection('In attesa di approvazione', '🔄', digest.inApproval, 'Nessun task in attesa.')}
        
      </div>
      
      <!-- CTA -->
      <div style="text-align:center; margin-bottom:20px;">
        <a href="${appUrl}" style="display:inline-block; background:#7c3aed; color:#fff; padding:12px 32px; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px; letter-spacing:0.5px;">
          Apri il HUB →
        </a>
      </div>
      
      <!-- Footer -->
      <div style="text-align:center; padding:16px;">
        <p style="color:#334155; font-size:11px; margin:0;">
          W[r]Digital HUB · Digest automatico generato alle ${new Date().toLocaleTimeString('it-IT')} ·
          <a href="${appUrl}/settings/notifications" style="color:#475569; text-decoration:none;">Gestisci notifiche</a>
        </p>
      </div>
      
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}
