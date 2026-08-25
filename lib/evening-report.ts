/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENING REPORT — Report Serale Operatori
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Questo file viene chiamato da:
 *   GET /api/cron/evening-report
 *
 * Lo scopo è:
 *   1. Leggere da Firestore tutti gli utenti (esclusi quelli nella lista EXCLUDED)
 *   2. Per ogni utente raccogliere:
 *      - Task lavorati oggi (updatedAt nel giorno corrente) con timeSpent
 *      - Task scaduti ancora aperti
 *      - Riepilogo settimanale: task assegnati con ore per giorno (lun-dom)
 *   3. Costruire un'email HTML riepilogativa per sezione utente
 *   4. Inviarla via Brevo SMTP a info@wrdigital.it ogni sera alle 18:00
 *
 * NOTE TECNICHE:
 *   - `timeSpent` nei task è in SECONDI (es. 3600 = 1 ora)
 *   - Il "giorno di lavoro" è determinato da `updatedAt` del task
 *   - Il riepilogo settimanale usa l'inizio settimana (lunedì) corrente
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { adminDb } from '@/lib/firebase-admin';

// ─── Costanti ─────────────────────────────────────────────────────────────────

/**
 * Nomi (parziali, case-insensitive) degli utenti da ESCLUDERE dal report.
 * Aggiungere qui eventuali futuri utenti da escludere.
 */
const EXCLUDED_NAMES = (
  process.env.EVENING_REPORT_EXCLUDED_NAMES || 'Valentina,Roberto,Beppe'
)
  .split(',')
  .map((n) => n.trim().toLowerCase())
  .filter(Boolean);

/** Ore lavorative giornaliere target (in secondi) */
const TARGET_DAILY_SECONDS = 8 * 3600; // 28800

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export interface ReportTask {
  id: string;
  title: string;
  clientId: string;
  clientName?: string;
  activityType?: string;
  timeSpent: number;   // in secondi
  status: string;
  dueDate?: string;
  updatedAt?: string;
  assignedUserId?: string;
}

export interface DailyActivity {
  task: ReportTask;
  /** Secondi lavorati su questo task (= task.timeSpent, cumulativo) */
  seconds: number;
}

export interface WeeklyDay {
  label: string;        // "Lun", "Mar", …
  date: string;         // "25/08"
  isoDate: string;      // "2026-08-25"
  totalSeconds: number; // somma timeSpent dei task aggiornati in quel giorno
  tasks: { title: string; seconds: number }[];
}

export interface UserReport {
  userId: string;
  userName: string;
  /** Task con updatedAt = oggi */
  todayActivities: DailyActivity[];
  /** Totale secondi registrati oggi */
  todayTotalSeconds: number;
  /** Differenza rispetto alle 8 ore (positivo = in eccesso, negativo = mancante) */
  todayDeltaSeconds: number;
  /** Numero di task scaduti non chiusi */
  overdueCount: number;
  /** Task scaduti (per dettaglio) */
  overdueTasks: ReportTask[];
  /** Riepilogo settimanale: 7 giorni lun-dom */
  weeklyDays: WeeklyDay[];
  /** Totale settimanale in secondi */
  weeklyTotalSeconds: number;
}

export interface EveningReportSummary {
  date: string;           // "Lunedì 25 agosto 2026"
  weekLabel: string;      // "Settimana 18 ago – 24 ago"
  users: UserReport[];
}

// ─── Utilità date ─────────────────────────────────────────────────────────────

function getTodayRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Restituisce i 7 giorni della settimana corrente (lun-dom) come oggetti {start, end}.
 */
function getCurrentWeekDays(): { isoDate: string; start: string; end: string; label: string; display: string }[] {
  const now = new Date();
  // Trova il lunedì della settimana corrente
  const dayOfWeek = now.getDay(); // 0=dom, 1=lun, …
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const labels = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const days = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    const display = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const isoDate = d.toISOString().split('T')[0]; // "2026-08-25"
    days.push({ isoDate, start: start.toISOString(), end: end.toISOString(), label: labels[i], display });
  }
  return days;
}

/** Formatta secondi come "2h 15m" o "45m" */
export function formatSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

/** Formatta delta in secondi come "+1h 30m" o "-5h 45m" */
function formatDelta(deltaSeconds: number): string {
  const abs = Math.abs(deltaSeconds);
  const sign = deltaSeconds >= 0 ? '+' : '-';
  return `${sign}${formatSeconds(abs)}`;
}

// ─── Query Firestore ───────────────────────────────────────────────────────────

/** Carica tutti gli utenti attivi (non clienti), escludendo i nomi nella lista EXCLUDED. */
async function loadActiveUsers(): Promise<{ id: string; name: string; email: string }[]> {
  try {
    const snapshot = await adminDb
      .collection('users')
      .where('status', '==', 'Attivo')
      .get();

    return snapshot.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: (d.name as string) || '',
          email: (d.email as string) || '',
          role: (d.role as string) || '',
        };
      })
      // Escludiamo i ruoli cliente e i nomi nella lista
      .filter((u) => {
        if (u.role === 'Cliente') return false;
        const nameLower = u.name.toLowerCase();
        return !EXCLUDED_NAMES.some((ex) => nameLower.includes(ex));
      })
      .map(({ id, name, email }) => ({ id, name, email }));
  } catch (error) {
    console.warn('[evening-report] Errore caricamento utenti:', error);
    return [];
  }
}

/** Carica i nomi dei clienti per arricchire i task. */
async function loadClientNames(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const snapshot = await adminDb.collection('clients').get();
    snapshot.docs.forEach((doc) => {
      map.set(doc.id, (doc.data().name as string) || doc.id);
    });
  } catch (error) {
    console.warn('[evening-report] Errore caricamento clienti:', error);
  }
  return map;
}

/**
 * Carica tutti i task assegnati a un utente.
 * Firestore non supporta query su updatedAt range + assignedUserId in modo diretto
 * senza un indice composto, quindi carichiamo tutti i task dell'utente e filtriamo in JS.
 */
async function loadUserTasks(userId: string): Promise<ReportTask[]> {
  try {
    const snapshot = await adminDb
      .collection('tasks')
      .where('assignedUserId', '==', userId)
      .get();

    return snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        title: (d.title as string) || '(senza titolo)',
        clientId: (d.clientId as string) || '',
        activityType: (d.activityType as string) || '',
        timeSpent: (d.timeSpent as number) || 0,
        status: (d.status as string) || '',
        dueDate: (d.dueDate as string) || undefined,
        updatedAt: (d.updatedAt as string) || undefined,
        assignedUserId: userId,
      } as ReportTask;
    });
  } catch (error) {
    console.warn(`[evening-report] Errore caricamento task per utente ${userId}:`, error);
    return [];
  }
}

// ─── Costruzione report per utente ────────────────────────────────────────────

function buildUserReport(
  userId: string,
  userName: string,
  tasks: ReportTask[],
  clientNames: Map<string, string>,
  todayRange: { start: string; end: string },
  weekDays: { isoDate: string; start: string; end: string; label: string; display: string }[]
): UserReport {
  // Arricchiamo con nome cliente
  const enriched = tasks.map((t) => ({
    ...t,
    clientName: clientNames.get(t.clientId) || t.clientId,
  }));

  // ── Task attivi/lavorati OGGI ────────────────────────────────────────────
  const todayStart = new Date(todayRange.start);
  const todayEnd = new Date(todayRange.end);
  const excludedStatuses = new Set(['Annullato']);

  const todayTasks = enriched.filter((t) => {
    if (excludedStatuses.has(t.status)) return false;
    if (!t.updatedAt) return false;
    const updated = new Date(t.updatedAt);
    return updated >= todayStart && updated <= todayEnd;
  });

  const todayActivities: DailyActivity[] = todayTasks.map((t) => ({
    task: t,
    seconds: t.timeSpent || 0,
  }));

  const todayTotalSeconds = todayActivities.reduce((sum, a) => sum + a.seconds, 0);
  const todayDeltaSeconds = todayTotalSeconds - TARGET_DAILY_SECONDS;

  // ── Task SCADUTI ─────────────────────────────────────────────────────────
  const excludedForOverdue = new Set(['Approvato', 'Annullato']);
  const todayStartStr = todayRange.start;

  const overdueTasks = enriched.filter((t) => {
    if (excludedForOverdue.has(t.status)) return false;
    if (!t.dueDate) return false;
    return t.dueDate < todayStartStr;
  });

  // ── Riepilogo SETTIMANALE ────────────────────────────────────────────────
  const weeklyDays: WeeklyDay[] = weekDays.map((day) => {
    const dayStart = new Date(day.start);
    const dayEnd = new Date(day.end);

    // Task aggiornati in questo giorno
    const dayTasks = enriched.filter((t) => {
      if (t.status === 'Annullato') return false;
      if (!t.updatedAt) return false;
      const updated = new Date(t.updatedAt);
      return updated >= dayStart && updated <= dayEnd;
    });

    const totalSeconds = dayTasks.reduce((sum, t) => sum + (t.timeSpent || 0), 0);

    return {
      label: day.label,
      date: day.display,
      isoDate: day.isoDate,
      totalSeconds,
      tasks: dayTasks.map((t) => ({
        title: t.title,
        seconds: t.timeSpent || 0,
      })),
    };
  });

  const weeklyTotalSeconds = weeklyDays.reduce((sum, d) => sum + d.totalSeconds, 0);

  return {
    userId,
    userName,
    todayActivities,
    todayTotalSeconds,
    todayDeltaSeconds,
    overdueCount: overdueTasks.length,
    overdueTasks,
    weeklyDays,
    weeklyTotalSeconds,
  };
}

// ─── Funzione principale ───────────────────────────────────────────────────────

export async function buildEveningReport(): Promise<EveningReportSummary> {
  const [users, clientNames] = await Promise.all([
    loadActiveUsers(),
    loadClientNames(),
  ]);

  const todayRange = getTodayRange();
  const weekDays = getCurrentWeekDays();

  // Carica i task di tutti gli utenti in parallelo
  const userTasksAll = await Promise.all(
    users.map((u) => loadUserTasks(u.id))
  );

  const userReports: UserReport[] = users.map((user, idx) => {
    return buildUserReport(
      user.id,
      user.name,
      userTasksAll[idx],
      clientNames,
      todayRange,
      weekDays
    );
  });

  // Ordinamento: per nome utente
  userReports.sort((a, b) => a.userName.localeCompare(b.userName, 'it'));

  // Etichetta settimana
  const monday = weekDays[0];
  const sunday = weekDays[6];
  const weekLabel = `Settimana ${monday.display} – ${sunday.display}`;

  return {
    date: new Date().toLocaleDateString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
    weekLabel,
    users: userReports,
  };
}

// ─── Costruttore HTML email ───────────────────────────────────────────────────

function deltaColor(delta: number): string {
  if (delta >= 0) return '#22c55e';        // verde: ha fatto almeno 8 ore
  if (delta >= -3600) return '#f59e0b';    // giallo: manca meno di 1 ora
  return '#ef4444';                         // rosso: manca più di 1 ora
}

function deltaBackground(delta: number): string {
  if (delta >= 0) return '#0f2a1f';
  if (delta >= -3600) return '#2a1f0f';
  return '#2a0f0f';
}

function deltaBorder(delta: number): string {
  if (delta >= 0) return '#166534';
  if (delta >= -3600) return '#92400e';
  return '#7f1d1d';
}

function buildUserSection(user: UserReport): string {
  // ── Attività di oggi ────────────────────────────────────────────────────
  const todayRows = user.todayActivities.length === 0
    ? `<tr><td colspan="4" style="padding:12px; color:#475569; font-style:italic; text-align:center;">Nessuna attività registrata oggi</td></tr>`
    : user.todayActivities.map((a) => `
      <tr>
        <td style="padding:8px 10px; border-bottom:1px solid #2a2a3a; color:#e2e8f0; font-size:13px;">${a.task.title}</td>
        <td style="padding:8px 10px; border-bottom:1px solid #2a2a3a; color:#94a3b8; font-size:12px;">${a.task.clientName || '—'}</td>
        <td style="padding:8px 10px; border-bottom:1px solid #2a2a3a; color:#64748b; font-size:12px;">${a.task.activityType || '—'}</td>
        <td style="padding:8px 10px; border-bottom:1px solid #2a2a3a; color:#a78bfa; font-size:12px; text-align:right; font-weight:600;">${formatSeconds(a.seconds)}</td>
      </tr>`).join('');

  // ── Totale + delta ──────────────────────────────────────────────────────
  const dColor = deltaColor(user.todayDeltaSeconds);
  const dBg = deltaBackground(user.todayDeltaSeconds);
  const dBorder = deltaBorder(user.todayDeltaSeconds);
  const dSign = user.todayDeltaSeconds >= 0 ? '✅' : user.todayDeltaSeconds >= -3600 ? '⚠️' : '🔴';

  const totaleRow = `
    <tr style="background:#0f0f1a;">
      <td colspan="3" style="padding:10px 10px; color:#94a3b8; font-size:12px; font-weight:600;">TOTALE GIORNALIERO</td>
      <td style="padding:10px 10px; color:#f1f5f9; font-size:14px; font-weight:700; text-align:right;">${formatSeconds(user.todayTotalSeconds)}</td>
    </tr>`;

  const deltaBar = `
    <div style="background:${dBg}; border:1px solid ${dBorder}; border-radius:8px; padding:10px 14px; margin-top:10px; display:flex; align-items:center; gap:12px;">
      <span style="font-size:18px;">${dSign}</span>
      <div>
        <span style="color:#94a3b8; font-size:12px;">Obiettivo: 8h</span>
        &nbsp;&nbsp;
        <span style="color:${dColor}; font-size:14px; font-weight:700;">${formatDelta(user.todayDeltaSeconds)}</span>
        <span style="color:#64748b; font-size:12px;"> rispetto all'obiettivo giornaliero</span>
      </div>
    </div>`;

  // ── Task scaduti ────────────────────────────────────────────────────────
  const overdueHtml = user.overdueCount === 0
    ? `<p style="color:#22c55e; font-size:13px; margin:0;">✅ Nessun task scaduto</p>`
    : `
      <div style="background:#2a0f0f; border:1px solid #7f1d1d; border-radius:8px; padding:10px 14px;">
        <p style="color:#fca5a5; font-size:13px; margin:0 0 8px; font-weight:600;">
          🚨 ${user.overdueCount} task scadut${user.overdueCount === 1 ? 'o' : 'i'}
        </p>
        <ul style="margin:0; padding-left:18px; color:#ef4444; font-size:12px;">
          ${user.overdueTasks.slice(0, 8).map((t) =>
            `<li style="margin-bottom:3px;">${t.title}${t.dueDate ? ` <span style="color:#7f1d1d;">(scaduto il ${new Date(t.dueDate).toLocaleDateString('it-IT')})</span>` : ''}</li>`
          ).join('')}
          ${user.overdueCount > 8 ? `<li style="color:#7f1d1d;">… e altri ${user.overdueCount - 8}</li>` : ''}
        </ul>
      </div>`;

  // ── Tabella settimanale ─────────────────────────────────────────────────
  const weekHeaderCells = user.weeklyDays.map((d) => `
    <th style="padding:6px 8px; text-align:center; color:#7c3aed; font-size:11px; font-weight:600; min-width:56px;">
      ${d.label}<br><span style="color:#475569; font-weight:400;">${d.date}</span>
    </th>`).join('');

  const weekTotalCells = user.weeklyDays.map((d) => `
    <td style="padding:6px 8px; text-align:center; color:${d.totalSeconds > 0 ? '#a78bfa' : '#334155'}; font-size:12px; font-weight:${d.totalSeconds > 0 ? '700' : '400'}; border-top:1px solid #2a2a4a;">
      ${d.totalSeconds > 0 ? formatSeconds(d.totalSeconds) : '—'}
    </td>`).join('');

  // Raccogliamo tutti i task unici della settimana
  const allWeekTaskTitles = new Set<string>();
  user.weeklyDays.forEach((d) => d.tasks.forEach((t) => allWeekTaskTitles.add(t.title)));

  const weekTaskRows = Array.from(allWeekTaskTitles).slice(0, 15).map((title) => {
    const cells = user.weeklyDays.map((d) => {
      const t = d.tasks.find((tt) => tt.title === title);
      return `<td style="padding:6px 8px; text-align:center; color:${t ? '#94a3b8' : '#1e293b'}; font-size:11px; border-bottom:1px solid #1a1a2e;">
        ${t ? formatSeconds(t.seconds) : '—'}
      </td>`;
    }).join('');

    return `<tr>
      <td style="padding:6px 10px; border-bottom:1px solid #1a1a2e; color:#e2e8f0; font-size:12px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${title}</td>
      ${cells}
    </tr>`;
  }).join('');

  const weeklyTable = allWeekTaskTitles.size === 0
    ? `<p style="color:#334155; font-size:13px; font-style:italic; margin:0;">Nessuna attività questa settimana</p>`
    : `
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; background:#1a1a2e; border-radius:8px; overflow:hidden; font-family:inherit; table-layout:auto;">
          <thead>
            <tr style="background:#0f0f1a;">
              <th style="padding:6px 10px; text-align:left; color:#7c3aed; font-size:11px; font-weight:600;">TASK</th>
              ${weekHeaderCells}
            </tr>
          </thead>
          <tbody>
            ${weekTaskRows}
          </tbody>
          <tfoot>
            <tr style="background:#0f0f1a;">
              <td style="padding:6px 10px; color:#94a3b8; font-size:11px; font-weight:600; border-top:1px solid #2a2a4a;">TOTALE</td>
              ${weekTotalCells}
            </tr>
            <tr style="background:#0f0f1a;">
              <td colspan="8" style="padding:4px 10px; color:#475569; font-size:11px; text-align:right;">
                Totale settimana: <strong style="color:#a78bfa;">${formatSeconds(user.weeklyTotalSeconds)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>`;

  return `
  <!-- ═══ UTENTE: ${user.userName} ═══ -->
  <div style="background:#1a1a2e; border:1px solid #2a2a4a; border-radius:12px; padding:22px; margin-bottom:28px;">

    <!-- Nome operatore -->
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid #2a2a4a;">
      <div style="width:36px; height:36px; border-radius:50%; background:#7c3aed; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
        <span style="color:#fff; font-size:15px; font-weight:700;">${user.userName.charAt(0).toUpperCase()}</span>
      </div>
      <h2 style="color:#f1f5f9; font-size:16px; font-weight:700; margin:0;">${user.userName}</h2>
      ${user.overdueCount > 0
        ? `<span style="background:#7f1d1d; color:#fca5a5; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px; margin-left:auto;">${user.overdueCount} scadut${user.overdueCount === 1 ? 'o' : 'i'}</span>`
        : ''}
    </div>

    <!-- Attività di oggi -->
    <h3 style="color:#94a3b8; font-size:12px; letter-spacing:2px; text-transform:uppercase; margin:0 0 10px; font-weight:600;">📋 Attività di Oggi</h3>
    <table style="width:100%; border-collapse:collapse; background:#0f0f1a; border-radius:8px; overflow:hidden; margin-bottom:4px;">
      <thead>
        <tr style="background:#0a0a14;">
          <th style="padding:8px 10px; text-align:left; color:#7c3aed; font-size:11px; font-weight:600;">TASK</th>
          <th style="padding:8px 10px; text-align:left; color:#7c3aed; font-size:11px; font-weight:600;">CLIENTE</th>
          <th style="padding:8px 10px; text-align:left; color:#7c3aed; font-size:11px; font-weight:600;">TIPO</th>
          <th style="padding:8px 10px; text-align:right; color:#7c3aed; font-size:11px; font-weight:600;">TEMPO</th>
        </tr>
      </thead>
      <tbody>${todayRows}</tbody>
      ${user.todayActivities.length > 0 ? `<tfoot>${totaleRow}</tfoot>` : ''}
    </table>

    ${deltaBar}

    <!-- Task scaduti -->
    <h3 style="color:#94a3b8; font-size:12px; letter-spacing:2px; text-transform:uppercase; margin:18px 0 10px; font-weight:600;">⚠️ Task Scaduti</h3>
    ${overdueHtml}

    <!-- Riepilogo settimanale -->
    <h3 style="color:#94a3b8; font-size:12px; letter-spacing:2px; text-transform:uppercase; margin:18px 0 10px; font-weight:600;">📅 Riepilogo Settimanale</h3>
    ${weeklyTable}

  </div>`;
}

/** Genera l'HTML completo dell'email report serale. */
export function buildEveningReportHtml(report: EveningReportSummary): string {
  const appUrl = process.env.APP_BASE_URL || 'http://localhost:9002';

  const totalOverdue = report.users.reduce((sum, u) => sum + u.overdueCount, 0);
  const subject = totalOverdue > 0
    ? `📊 Report Serale — ${totalOverdue} task scaduti — ${report.date}`
    : `📊 Report Serale Operatori — ${report.date}`;

  const userSections = report.users.length === 0
    ? `<p style="color:#475569; text-align:center; padding:24px;">Nessun operatore attivo trovato.</p>`
    : report.users.map(buildUserSection).join('');

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background:#0d0d1a; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <table role="presentation" style="width:100%; max-width:680px; margin:0 auto; padding:24px 0;">
    <tr><td>

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%); border:1px solid #2a2a4a; border-radius:12px; padding:28px; margin-bottom:24px; text-align:center;">
        <p style="color:#7c3aed; font-size:11px; letter-spacing:3px; text-transform:uppercase; margin:0 0 8px;">W[r]Digital HUB</p>
        <h1 style="color:#f1f5f9; font-size:22px; margin:0 0 6px; font-weight:700;">Report Serale Operatori</h1>
        <p style="color:#64748b; font-size:14px; margin:0 0 4px; text-transform:capitalize;">${report.date}</p>
        <p style="color:#475569; font-size:12px; margin:0;">${report.weekLabel}</p>
      </div>

      <!-- Stats bar -->
      <table style="width:100%; border-collapse:separate; border-spacing:8px; margin-bottom:20px;">
        <tr>
          <td style="background:#1a1a2e; border:1px solid #2a2a4a; border-radius:8px; padding:14px; text-align:center;">
            <div style="color:#a78bfa; font-size:26px; font-weight:700;">${report.users.length}</div>
            <div style="color:#7c3aed; font-size:11px; margin-top:4px;">Operatori</div>
          </td>
          <td style="background:${totalOverdue > 0 ? '#2a0f0f' : '#1a1a2e'}; border:1px solid ${totalOverdue > 0 ? '#7f1d1d' : '#2a2a4a'}; border-radius:8px; padding:14px; text-align:center;">
            <div style="color:${totalOverdue > 0 ? '#ef4444' : '#64748b'}; font-size:26px; font-weight:700;">${totalOverdue}</div>
            <div style="color:${totalOverdue > 0 ? '#fca5a5' : '#475569'}; font-size:11px; margin-top:4px;">Task Scaduti</div>
          </td>
          <td style="background:#1a1a2e; border:1px solid #2a2a4a; border-radius:8px; padding:14px; text-align:center;">
            <div style="color:#22c55e; font-size:26px; font-weight:700;">${formatSeconds(report.users.reduce((sum, u) => sum + u.todayTotalSeconds, 0))}</div>
            <div style="color:#86efac; font-size:11px; margin-top:4px;">Ore Totali Oggi</div>
          </td>
        </tr>
      </table>

      <!-- Sezioni per ogni utente -->
      ${userSections}

      <!-- CTA -->
      <div style="text-align:center; margin:24px 0 20px;">
        <a href="${appUrl}" style="display:inline-block; background:#7c3aed; color:#fff; padding:12px 32px; border-radius:8px; text-decoration:none; font-weight:600; font-size:14px; letter-spacing:0.5px;">
          Apri il HUB →
        </a>
      </div>

      <!-- Footer -->
      <div style="text-align:center; padding:16px;">
        <p style="color:#334155; font-size:11px; margin:0;">
          W[r]Digital HUB · Report serale generato alle ${new Date().toLocaleTimeString('it-IT')} ·
          <a href="${appUrl}/settings/notifications" style="color:#475569; text-decoration:none;">Gestisci notifiche</a>
        </p>
      </div>

    </td></tr>
  </table>
</body>
</html>
`.trim();
}
