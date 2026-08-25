/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENING REPORT — Report Serale Operatori (Light & Clear Theme)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Questo file viene chiamato da:
 *   GET /api/cron/evening-report
 *
 * Lo scopo è:
 *   1. Leggere da Firestore tutti gli utenti (esclusi Valentina, Roberto, Beppe, Giuseppe)
 *   2. Per ogni utente raccogliere:
 *      - Attività di calendario + Task lavorati nel giorno target
 *      - Tempo registrato per ogni attività e task
 *      - Totale ore del giorno e differenza rispetto alle 8 ore
 *      - Task scaduti ancora aperti
 *      - Riepilogo settimanale per ogni giorno della settimana
 *   3. Costruire un'email HTML CHIARA (tema bianco / testuale / pulito)
 *   4. Inviarla via Brevo SMTP (sender hub@wrdigital.it) a info@wrdigital.it
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { adminDb } from '@/lib/firebase-admin';

// ─── Costanti ─────────────────────────────────────────────────────────────────

const EXCLUDED_NAMES = (
  process.env.EVENING_REPORT_EXCLUDED_NAMES || 'Valentina,Roberto,Beppe,Giuseppe'
)
  .split(',')
  .map((n) => n.trim().toLowerCase())
  .filter(Boolean);

const TARGET_DAILY_SECONDS = 8 * 3600; // 8 ore

// ─── Tipi ─────────────────────────────────────────────────────────────────────

export interface ReportItem {
  id: string;
  title: string;
  type: 'calendar' | 'task';
  clientName?: string;
  category?: string;
  seconds: number;
  status?: string;
  dueDate?: string;
}

export interface WeeklyDay {
  label: string;        // "Lun", "Mar", …
  date: string;         // "25/08"
  isoDate: string;      // "2026-08-25"
  totalSeconds: number;
  items: { title: string; seconds: number; type: 'calendar' | 'task' }[];
}

export interface UserReport {
  userId: string;
  userName: string;
  todayItems: ReportItem[];
  todayTotalSeconds: number;
  todayDeltaSeconds: number;
  overdueCount: number;
  overdueTasks: { id: string; title: string; dueDate?: string; clientName?: string }[];
  weeklyDays: WeeklyDay[];
  weeklyTotalSeconds: number;
}

export interface EveningReportSummary {
  date: string;
  weekLabel: string;
  users: UserReport[];
}

// ─── Utilità date ─────────────────────────────────────────────────────────────

function getDayRange(targetDate?: Date): { start: string; end: string } {
  const base = targetDate ? new Date(targetDate) : new Date();
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getCurrentWeekDays(targetDate?: Date): { isoDate: string; start: string; end: string; label: string; display: string }[] {
  const base = targetDate ? new Date(targetDate) : new Date();
  const dayOfWeek = base.getDay();
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((dayOfWeek + 6) % 7));
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
    const isoDate = d.toISOString().split('T')[0];
    days.push({ isoDate, start: start.toISOString(), end: end.toISOString(), label: labels[i], display });
  }
  return days;
}

export function formatSeconds(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatDelta(deltaSeconds: number): string {
  const abs = Math.abs(deltaSeconds);
  const sign = deltaSeconds >= 0 ? '+' : '-';
  return `${sign}${formatSeconds(abs)}`;
}

function parseDateValue(val: any): Date | null {
  if (!val) return null;
  if (typeof val === 'string') return new Date(val);
  if (val._seconds) return new Date(val._seconds * 1000);
  if (val.toDate && typeof val.toDate === 'function') return val.toDate();
  return null;
}

// ─── Query Firestore ───────────────────────────────────────────────────────────

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

// ─── Costruzione Report ────────────────────────────────────────────────────────

export async function buildEveningReport(targetDate?: Date): Promise<EveningReportSummary> {
  const effectiveDate = targetDate || new Date();
  const [users, clientNames] = await Promise.all([
    loadActiveUsers(),
    loadClientNames(),
  ]);

  const dayRange = getDayRange(effectiveDate);
  const weekDays = getCurrentWeekDays(effectiveDate);
  const dayStart = new Date(dayRange.start);
  const dayEnd = new Date(dayRange.end);

  // Carichiamo tutte le calendarActivities e tutti i tasks
  const [activitiesSnap, tasksSnap] = await Promise.all([
    adminDb.collection('calendarActivities').get(),
    adminDb.collection('tasks').get(),
  ]);

  const allActivities = activitiesSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: (data.title as string) || 'Attività calendario',
      userId: (data.userId as string) || '',
      clientId: (data.clientId as string) || '',
      startTime: parseDateValue(data.startTime || data.start),
      endTime: parseDateValue(data.endTime || data.end),
    };
  });

  const allTasks = tasksSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      title: (data.title as string) || '(senza titolo)',
      assignedUserId: (data.assignedUserId as string) || '',
      clientId: (data.clientId as string) || '',
      activityType: (data.activityType as string) || '',
      timeSpent: (data.timeSpent as number) || 0,
      status: (data.status as string) || '',
      dueDate: parseDateValue(data.dueDate),
      updatedAt: parseDateValue(data.updatedAt),
    };
  });

  const userReports: UserReport[] = users.map((user) => {
    const userActivities = allActivities.filter((a) => a.userId === user.id);
    const userTasks = allTasks.filter((t) => t.assignedUserId === user.id);

    // 1. Attività di oggi:
    const todayItems: ReportItem[] = [];

    // Calendar activities del giorno
    userActivities.forEach((act) => {
      if (act.startTime && act.startTime >= dayStart && act.startTime <= dayEnd) {
        let durationSec = 0;
        if (act.endTime && act.startTime) {
          durationSec = Math.max(0, Math.floor((act.endTime.getTime() - act.startTime.getTime()) / 1000));
        }
        todayItems.push({
          id: act.id,
          title: act.title,
          type: 'calendar',
          clientName: clientNames.get(act.clientId) || '',
          seconds: durationSec,
        });
      }
    });

    // Task del giorno (se aggiornati oggi e con timeSpent > 0 oppure con dueDate oggi)
    userTasks.forEach((t) => {
      if (t.status === 'Annullato') return;
      const isUpdatedToday = t.updatedAt && t.updatedAt >= dayStart && t.updatedAt <= dayEnd;
      const isDueToday = t.dueDate && t.dueDate >= dayStart && t.dueDate <= dayEnd;

      if (isUpdatedToday || isDueToday) {
        todayItems.push({
          id: t.id,
          title: t.title,
          type: 'task',
          clientName: clientNames.get(t.clientId) || '',
          category: t.activityType,
          seconds: t.timeSpent || 0,
          status: t.status,
          dueDate: t.dueDate ? t.dueDate.toISOString() : undefined,
        });
      }
    });

    const todayTotalSeconds = todayItems.reduce((s, item) => s + item.seconds, 0);
    const todayDeltaSeconds = todayTotalSeconds - TARGET_DAILY_SECONDS;

    // 2. Task scaduti non completati
    const overdueTasks = userTasks
      .filter((t) => {
        if (['Approvato', 'Annullato'].includes(t.status)) return false;
        if (!t.dueDate) return false;
        return t.dueDate < dayStart;
      })
      .map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate ? t.dueDate.toISOString() : undefined,
        clientName: clientNames.get(t.clientId) || '',
      }));

    // 3. Riepilogo settimanale
    const weeklyDays: WeeklyDay[] = weekDays.map((wDay) => {
      const wStart = new Date(wDay.start);
      const wEnd = new Date(wDay.end);
      const dayItems: { title: string; seconds: number; type: 'calendar' | 'task' }[] = [];

      // Calendar activities
      userActivities.forEach((act) => {
        if (act.startTime && act.startTime >= wStart && act.startTime <= wEnd) {
          let durationSec = 0;
          if (act.endTime && act.startTime) {
            durationSec = Math.max(0, Math.floor((act.endTime.getTime() - act.startTime.getTime()) / 1000));
          }
          dayItems.push({ title: act.title, seconds: durationSec, type: 'calendar' });
        }
      });

      // Tasks
      userTasks.forEach((t) => {
        if (t.status === 'Annullato') return;
        const inWeek = (t.updatedAt && t.updatedAt >= wStart && t.updatedAt <= wEnd) ||
                       (t.dueDate && t.dueDate >= wStart && t.dueDate <= wEnd);
        if (inWeek && t.timeSpent > 0) {
          dayItems.push({ title: t.title, seconds: t.timeSpent, type: 'task' });
        }
      });

      const totalSeconds = dayItems.reduce((s, i) => s + i.seconds, 0);

      return {
        label: wDay.label,
        date: wDay.display,
        isoDate: wDay.isoDate,
        totalSeconds,
        items: dayItems,
      };
    });

    const weeklyTotalSeconds = weeklyDays.reduce((s, d) => s + d.totalSeconds, 0);

    return {
      userId: user.id,
      userName: user.name,
      todayItems,
      todayTotalSeconds,
      todayDeltaSeconds,
      overdueCount: overdueTasks.length,
      overdueTasks,
      weeklyDays,
      weeklyTotalSeconds,
    };
  });

  userReports.sort((a, b) => a.userName.localeCompare(b.userName, 'it'));

  const monday = weekDays[0];
  const sunday = weekDays[6];
  const weekLabel = `Settimana ${monday.display} – ${sunday.display}`;

  return {
    date: effectiveDate.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }),
    weekLabel,
    users: userReports,
  };
}

// ─── Costruttore HTML email (Light & Clean) ───────────────────────────────────

function buildUserSectionHtml(user: UserReport): string {
  // Attività del giorno
  const todayRows = user.todayItems.length === 0
    ? `<tr><td colspan="4" style="padding:10px 12px; color:#6b7280; font-style:italic; border-bottom:1px solid #e5e7eb;">Nessuna attività o task registrato nel giorno</td></tr>`
    : user.todayItems.map((item) => `
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:8px 12px; color:#111827; font-size:13px; font-weight:500;">
          ${item.type === 'calendar' ? '🗓️ ' : '📋 '} ${item.title}
        </td>
        <td style="padding:8px 12px; color:#4b5563; font-size:12px;">
          ${item.clientName || '—'}
        </td>
        <td style="padding:8px 12px; color:#6b7280; font-size:12px;">
          ${item.category || (item.type === 'calendar' ? 'Calendario' : item.status || 'Task')}
        </td>
        <td style="padding:8px 12px; color:#111827; font-size:13px; font-weight:600; text-align:right;">
          ${formatSeconds(item.seconds)}
        </td>
      </tr>`).join('');

  // Delta calcolo colore
  const deltaText = formatDelta(user.todayDeltaSeconds);
  const deltaColor = user.todayDeltaSeconds >= 0 ? '#15803d' : '#b91c1c';
  const deltaBg = user.todayDeltaSeconds >= 0 ? '#f0fdf4' : '#fef2f2';
  const deltaBorder = user.todayDeltaSeconds >= 0 ? '#bbf7d0' : '#fecaca';

  // Task scaduti
  const overdueSection = user.overdueCount === 0
    ? `<div style="color:#16a34a; font-size:12px; margin-top:10px;">✓ Nessun task scaduto</div>`
    : `
      <div style="background:#fff1f2; border:1px solid #fecdd3; border-radius:6px; padding:10px 14px; margin-top:12px;">
        <strong style="color:#9f1239; font-size:13px;">⚠️ ${user.overdueCount} task scadut${user.overdueCount === 1 ? 'o' : 'i'}</strong>
        <ul style="margin:6px 0 0 0; padding-left:18px; color:#be123c; font-size:12px; line-height:1.5;">
          ${user.overdueTasks.slice(0, 6).map((t) => `
            <li>${t.title} ${t.clientName ? `(${t.clientName})` : ''} ${t.dueDate ? `— scaduto il ${new Date(t.dueDate).toLocaleDateString('it-IT')}` : ''}</li>
          `).join('')}
          ${user.overdueCount > 6 ? `<li>... e altri ${user.overdueCount - 6}</li>` : ''}
        </ul>
      </div>`;

  // Settimana
  const weekHeader = user.weeklyDays.map((d) => `
    <th style="padding:6px 8px; text-align:center; color:#374151; font-size:11px; font-weight:600; border:1px solid #e5e7eb; background:#f9fafb;">
      ${d.label}<br><span style="color:#6b7280; font-weight:400;">${d.date}</span>
    </th>`).join('');

  const weekTotals = user.weeklyDays.map((d) => `
    <td style="padding:6px 8px; text-align:center; font-size:12px; font-weight:${d.totalSeconds > 0 ? '600' : '400'}; color:${d.totalSeconds > 0 ? '#111827' : '#9ca3af'}; border:1px solid #e5e7eb;">
      ${d.totalSeconds > 0 ? formatSeconds(d.totalSeconds) : '—'}
    </td>`).join('');

  return `
  <!-- Scheda Operatore: ${user.userName} -->
  <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:20px; margin-bottom:24px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
    
    <!-- Nome Operatore -->
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #f3f4f6; padding-bottom:10px; margin-bottom:14px;">
      <h2 style="color:#111827; font-size:16px; margin:0; font-weight:700;">
        👤 ${user.userName}
      </h2>
      <span style="font-size:13px; color:#4b5563;">
        Totale Giorno: <strong style="color:#111827; font-size:14px;">${formatSeconds(user.todayTotalSeconds)}</strong>
      </span>
    </div>

    <!-- Attività del giorno -->
    <div style="margin-bottom:12px;">
      <table style="width:100%; border-collapse:collapse; background:#ffffff; border:1px solid #e5e7eb; border-radius:6px; overflow:hidden;">
        <thead>
          <tr style="background:#f9fafb; border-bottom:1px solid #e5e7eb;">
            <th style="padding:8px 12px; text-align:left; color:#374151; font-size:11px; font-weight:600; text-transform:uppercase;">Attività / Task</th>
            <th style="padding:8px 12px; text-align:left; color:#374151; font-size:11px; font-weight:600; text-transform:uppercase;">Cliente</th>
            <th style="padding:8px 12px; text-align:left; color:#374151; font-size:11px; font-weight:600; text-transform:uppercase;">Tipo / Stato</th>
            <th style="padding:8px 12px; text-align:right; color:#374151; font-size:11px; font-weight:600; text-transform:uppercase;">Tempo</th>
          </tr>
        </thead>
        <tbody>
          ${todayRows}
        </tbody>
      </table>
    </div>

    <!-- Differenza 8 ore -->
    <div style="background:${deltaBg}; border:1px solid ${deltaBorder}; border-radius:6px; padding:8px 12px; font-size:12px; color:#374151; display:flex; justify-content:space-between; align-items:center;">
      <span>Obiettivo giornaliero: <strong>8h</strong></span>
      <span>Differenza: <strong style="color:${deltaColor}; font-size:13px;">${deltaText}</strong></span>
    </div>

    <!-- Task scaduti -->
    ${overdueSection}

    <!-- Riepilogo Settimana -->
    <div style="margin-top:14px;">
      <p style="font-size:12px; font-weight:600; color:#374151; margin:0 0 6px 0;">📅 Riepilogo settimana (Totale: ${formatSeconds(user.weeklyTotalSeconds)})</p>
      <table style="width:100%; border-collapse:collapse; background:#ffffff; text-align:center;">
        <thead>
          <tr>${weekHeader}</tr>
        </thead>
        <tbody>
          <tr>${weekTotals}</tr>
        </tbody>
      </table>
    </div>

  </div>`;
}

export function buildEveningReportHtml(report: EveningReportSummary): string {
  const appUrl = process.env.APP_BASE_URL || 'https://hub.wrdigital.it';
  const totalOverdue = report.users.reduce((sum, u) => sum + u.overdueCount, 0);
  const totalSecondsAll = report.users.reduce((sum, u) => sum + u.todayTotalSeconds, 0);

  const subject = totalOverdue > 0
    ? `📊 Report Serale Operatori (${totalOverdue} scaduti) — ${report.date}`
    : `📊 Report Serale Operatori — ${report.date}`;

  const userCards = report.users.length === 0
    ? `<p style="color:#6b7280; text-align:center; padding:20px;">Nessun operatore attivo trovato.</p>`
    : report.users.map(buildUserSectionHtml).join('');

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; background:#f3f4f6; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#111827; line-height:1.5;">

  <table role="presentation" style="width:100%; max-width:680px; margin:0 auto; padding:20px 10px;">
    <tr><td>

      <!-- Header Chiaro -->
      <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:24px; margin-bottom:20px; text-align:center; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <p style="color:#6366f1; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; margin:0 0 6px;">W[r]Digital Hub</p>
        <h1 style="color:#111827; font-size:22px; margin:0 0 4px; font-weight:800;">Report Serale Operatori</h1>
        <p style="color:#4b5563; font-size:14px; margin:0 0 2px; text-transform:capitalize;">${report.date}</p>
        <p style="color:#9ca3af; font-size:12px; margin:0;">${report.weekLabel}</p>
      </div>

      <!-- Statistiche Generali -->
      <table style="width:100%; border-collapse:separate; border-spacing:8px; margin-bottom:20px;">
        <tr>
          <td style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:12px; text-align:center; width:33.33%;">
            <div style="color:#4f46e5; font-size:24px; font-weight:700;">${report.users.length}</div>
            <div style="color:#6b7280; font-size:11px; margin-top:2px;">Operatori</div>
          </td>
          <td style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:12px; text-align:center; width:33.33%;">
            <div style="color:${totalOverdue > 0 ? '#dc2626' : '#16a34a'}; font-size:24px; font-weight:700;">${totalOverdue}</div>
            <div style="color:#6b7280; font-size:11px; margin-top:2px;">Task Scaduti Totali</div>
          </td>
          <td style="background:#ffffff; border:1px solid #e5e7eb; border-radius:8px; padding:12px; text-align:center; width:33.33%;">
            <div style="color:#16a34a; font-size:24px; font-weight:700;">${formatSeconds(totalSecondsAll)}</div>
            <div style="color:#6b7280; font-size:11px; margin-top:2px;">Ore Registrate Oggi</div>
          </td>
        </tr>
      </table>

      <!-- Schede Operatori -->
      ${userCards}

      <!-- Footer e Link -->
      <div style="text-align:center; padding:16px 0;">
        <a href="${appUrl}" style="display:inline-block; background:#4f46e5; color:#ffffff; padding:10px 24px; border-radius:6px; text-decoration:none; font-weight:600; font-size:13px;">
          Apri W[r]Digital Hub →
        </a>
        <p style="color:#9ca3af; font-size:11px; margin:16px 0 0 0;">
          Email generata automaticamente dal sistema W[r]Digital Hub
        </p>
      </div>

    </td></tr>
  </table>

</body>
</html>
`.trim();
}
