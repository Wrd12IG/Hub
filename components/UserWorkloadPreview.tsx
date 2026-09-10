'use client';

import React, { useMemo } from 'react';
import { format, isToday, isYesterday, isTomorrow, addDays, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { it } from 'date-fns/locale';
import { WorkloadSphere } from '@/components/WorkloadSphere';
import type { Task, CalendarActivity } from '@/lib/data';

interface UserWorkloadPreviewProps {
  userId?: string;
  selectedDate?: Date | string;
  previewHours?: number;
  excludeTaskId?: string;
  excludeActivityId?: string;
  allTasks: Task[];
  calendarActivities?: CalendarActivity[];
}

export function UserWorkloadPreview({
  userId,
  selectedDate,
  previewHours = 0,
  excludeTaskId,
  excludeActivityId,
  allTasks = [],
  calendarActivities = [],
}: UserWorkloadPreviewProps) {
  // Parse reference date
  const baseDate = useMemo(() => {
    if (!selectedDate) return new Date();
    if (selectedDate instanceof Date) {
      return isNaN(selectedDate.getTime()) ? new Date() : selectedDate;
    }
    if (typeof selectedDate === 'string') {
      if (selectedDate.includes('T')) {
        const d = new Date(selectedDate);
        return isNaN(d.getTime()) ? new Date() : d;
      }
      const parts = selectedDate.split('-').map(Number);
      if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }
      const parsed = new Date(selectedDate);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    return new Date();
  }, [selectedDate]);

  // If no user selected
  if (!userId || userId === 'nessuno') {
    return (
      <div className="mt-3 p-3 rounded-xl border border-dashed bg-muted/20 text-xs text-muted-foreground text-center">
        Seleziona un utente per vedere il carico di lavoro
      </div>
    );
  }

  // ── Shared helpers ──────────────────────────────────────────────
  const WORK_HOURS_DAY = 8;
  const WORK_DAYS_WEEK = 5;
  const now = new Date();

  const activeTasks = allTasks.filter(
    (t) =>
      t.assignedUserId === userId &&
      t.status !== 'Approvato' &&
      t.status !== 'Annullato' &&
      t.id !== excludeTaskId
  );

  const userActivities = (calendarActivities || []).filter(
    (a) =>
      a.userId === userId &&
      a.id !== excludeActivityId &&
      (a.startTime || (a as any).start) &&
      (a.endTime || (a as any).end)
  );

  const taskRefDate = (t: Task): Date => {
    if (t.dueDate) return new Date(t.dueDate);
    if (t.updatedAt) return new Date(t.updatedAt as string);
    return now;
  };

  const inRange = (d: Date, start: Date, end: Date) => d >= start && d <= end;

  const activityHoursInRange = (start: Date, end: Date): number =>
    userActivities
      .filter((a) => {
        const s = new Date(a.startTime || (a as any).start);
        return inRange(s, start, end);
      })
      .reduce((acc, a) => {
        const s = new Date(a.startTime || (a as any).start).getTime();
        const e = new Date(a.endTime || (a as any).end).getTime();
        return acc + Math.max(0, (e - s) / (1000 * 3600));
      }, 0);

  const pct = (val: number, max: number) => Math.min((val / max) * 100, 100);
  const color = (p: number) => (p < 60 ? '#22c55e' : p < 85 ? '#f59e0b' : '#ef4444');
  const badge = (p: number) => (p < 60 ? 'Libero' : p < 85 ? 'Quasi pieno' : 'Sovraccarico');

  // ── 3-DAY stats ─────────────────────────────────────────────────
  const threeDays = [
    { key: 'prev' as const, date: subDays(baseDate, 1), isSelected: false },
    { key: 'curr' as const, date: baseDate, isSelected: true },
    { key: 'next' as const, date: addDays(baseDate, 1), isSelected: false },
  ];

  const dayStats = threeDays.map(({ date, isSelected, key }) => {
    const sod = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const eod = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

    const taskH = activeTasks
      .filter((t) => inRange(taskRefDate(t), sod, eod))
      .reduce((acc, t) => acc + (t.estimatedDuration || 0) / 60, 0);

    const actH = activityHoursInRange(sod, eod);
    const baseHours = taskH + actH;
    const preview = isSelected ? Math.max(0, previewHours) : 0;
    const totalHours = baseHours + preview;
    const loadPct = pct(totalHours, WORK_HOURS_DAY);

    const fd = format(date, 'd MMM', { locale: it });
    const dn = format(date, 'EEE', { locale: it });
    const cap = dn.charAt(0).toUpperCase() + dn.slice(1);

    let fullLabel = `${cap} ${fd}`;
    let sphereLabel = `${cap} ${fd}`;

    if (key === 'curr') {
      fullLabel = `Giorno Scelto (${cap} ${fd})`;
      sphereLabel = isToday(date) ? `Oggi (${fd})` : `Scelto (${fd})`;
    } else if (key === 'prev') {
      fullLabel = isYesterday(date) ? `Ieri (${cap} ${fd})` : `Giorno Prima (${cap} ${fd})`;
      sphereLabel = isYesterday(date) ? `Ieri (${fd})` : `Prima (${fd})`;
    } else {
      fullLabel = isTomorrow(date) ? `Domani (${cap} ${fd})` : `Giorno Dopo (${cap} ${fd})`;
      sphereLabel = isTomorrow(date) ? `Domani (${fd})` : `Dopo (${fd})`;
    }

    return { key, date, isSelected, baseHours, preview, totalHours, loadPct, fullLabel, sphereLabel };
  });

  // ── WEEK stats ───────────────────────────────────────────────────
  const sowRef = startOfWeek(baseDate, { weekStartsOn: 1 });
  const eowRef = endOfWeek(baseDate, { weekStartsOn: 1 });
  const weekTasksH = activeTasks
    .filter((t) => (t.dueDate ? inRange(new Date(t.dueDate), sowRef, eowRef) : false))
    .reduce((acc, t) => acc + (t.estimatedDuration || 0) / 60, 0);
  const weekUndatedH = activeTasks
    .filter((t) => !t.dueDate)
    .reduce((acc, t) => acc + (t.estimatedDuration || 0) / 60, 0);
  const weekActH = activityHoursInRange(sowRef, eowRef);
  const weekBaseHours = weekTasksH + weekUndatedH + weekActH;
  const maxWeek = WORK_HOURS_DAY * WORK_DAYS_WEEK;

  // due-date of preview falls in this week?
  const inWeek = inRange(baseDate, sowRef, eowRef);
  const previewWeek = (previewHours > 0 && inWeek) ? previewHours : (previewHours > 0 && !baseDate ? previewHours : 0);
  const weekTotalH = weekBaseHours + (inWeek ? previewHours : 0);

  // ── MONTH stats ──────────────────────────────────────────────────
  const somRef = startOfMonth(baseDate);
  const eomRef = endOfMonth(baseDate);
  let workDaysMonth = 0;
  for (let d = new Date(somRef); d <= eomRef; d.setDate(d.getDate() + 1)) {
    if (d.getDay() !== 0 && d.getDay() !== 6) workDaysMonth++;
  }
  const maxMonth = WORK_HOURS_DAY * workDaysMonth;

  const monthTasksH = activeTasks
    .filter((t) => (t.dueDate ? inRange(new Date(t.dueDate), somRef, eomRef) : false))
    .reduce((acc, t) => acc + (t.estimatedDuration || 0) / 60, 0);
  const monthUndatedH = activeTasks
    .filter((t) => !t.dueDate)
    .reduce((acc, t) => acc + (t.estimatedDuration || 0) / 60, 0);
  const monthActH = activityHoursInRange(somRef, eomRef);
  const monthBaseHours = monthTasksH + monthUndatedH + monthActH;
  const inMonth = inRange(baseDate, somRef, eomRef);
  const monthTotalH = monthBaseHours + (inMonth ? previewHours : 0);

  const hasPreview = previewHours > 0;
  const totalActiveTasks = activeTasks.length;
  const undatedCount = activeTasks.filter((t) => !t.dueDate).length;

  const WorkloadBar = ({
    hours, preview, max, label: lbl,
  }: { hours: number; preview: number; max: number; label: string }) => {
    const pBase = pct(hours, max);
    const pTotal = pct(hours + preview, max);
    const cBase = color(pBase);
    const cTotal = color(pTotal);
    const hp = preview > 0;
    return (
      <div className="mb-1.5">
        <div className="flex justify-between items-center mb-0.5 text-[11px]">
          <span className="font-medium text-foreground">{lbl}</span>
          <span className="flex items-center gap-1 font-semibold tabular-nums" style={{ color: hp ? cTotal : cBase }}>
            {hp ? (
              <>
                {hours.toFixed(1)}
                <span style={{ color: cTotal, opacity: 0.85 }}>+{preview.toFixed(1)}</span>
                h / {max}h
              </>
            ) : (
              <>{hours.toFixed(1)}h / {max}h</>
            )}
            <span className="ml-0.5 text-[10px] opacity-60">({badge(pTotal)})</span>
          </span>
        </div>
        <div className="relative w-full h-2 rounded-full bg-secondary overflow-hidden">
          <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-300" style={{ width: `${pBase}%`, backgroundColor: cBase }} />
          {hp && (
            <div
              className="absolute top-0 h-full rounded-r-full transition-all duration-300"
              style={{
                left: `${pBase}%`,
                width: `${Math.min(pct(preview, max), 100 - pBase)}%`,
                backgroundColor: cTotal,
                opacity: 0.45,
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.35) 3px, rgba(255,255,255,0.35) 5px)',
              }}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-3 p-3.5 rounded-xl border bg-card/60 backdrop-blur-sm text-xs shadow-sm space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <span className="text-sm">⏱</span>
          <span>Carico Utente</span>
          <span className="font-normal text-[10px] text-muted-foreground">
            ({totalActiveTasks} task attivi{undatedCount > 0 ? `, ${undatedCount} senza data` : ''})
          </span>
        </div>
        {hasPreview && (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            +{previewHours >= 1 ? `${previewHours.toFixed(1)}h` : `${Math.round(previewHours * 60)} min`} anteprima
          </span>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-3">

        {/* LEFT: 3-day view */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">📅 3 Giorni</p>

          {/* 3 spheres */}
          <div className="grid grid-cols-3 gap-1 bg-muted/20 rounded-lg p-1.5 items-end justify-items-center">
            {dayStats.map((stat) => (
              <div
                key={stat.key}
                className={`flex flex-col items-center p-1 rounded-lg w-full transition-all ${
                  stat.isSelected ? 'bg-primary/5 ring-1 ring-primary/30' : 'opacity-85'
                }`}
              >
                <WorkloadSphere load={stat.loadPct} size={stat.isSelected ? 44 : 38} label={stat.sphereLabel} />
                {stat.isSelected && (
                  <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-primary">
                    ★
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* 3 bars */}
          <div className="space-y-1">
            {dayStats.map((stat) => {
              const pBase = pct(stat.baseHours, WORK_HOURS_DAY);
              const pTotal = pct(stat.totalHours, WORK_HOURS_DAY);
              const cBase = color(pBase);
              const cTotal = color(pTotal);
              const hp = stat.preview > 0;
              return (
                <div
                  key={stat.key}
                  className={`p-1.5 rounded-lg border ${
                    stat.isSelected ? 'bg-background border-primary/30' : 'bg-muted/10 border-border/40'
                  }`}
                >
                  <div className="flex justify-between items-center mb-0.5 text-[10px]">
                    <span className={`flex items-center gap-1 font-medium ${stat.isSelected ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                      {stat.isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />}
                      {stat.fullLabel}
                    </span>
                    <span className="font-semibold tabular-nums" style={{ color: hp ? cTotal : cBase }}>
                      {hp ? (
                        <>{stat.baseHours.toFixed(1)}<span style={{ opacity: 0.85 }}>+{stat.preview.toFixed(1)}</span>h</>
                      ) : (
                        <>{stat.baseHours.toFixed(1)}h</>
                      )}
                    </span>
                  </div>
                  <div className="relative w-full h-1.5 rounded-full bg-secondary/80 overflow-hidden">
                    <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-300" style={{ width: `${pBase}%`, backgroundColor: cBase }} />
                    {hp && (
                      <div
                        className="absolute top-0 h-full rounded-r-full transition-all duration-300"
                        style={{
                          left: `${pBase}%`,
                          width: `${Math.min(pct(stat.preview, WORK_HOURS_DAY), 100 - pBase)}%`,
                          backgroundColor: cTotal,
                          opacity: 0.5,
                          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.4) 3px, rgba(255,255,255,0.4) 5px)',
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Week + Month */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">📊 Riepilogo</p>

          {/* Spheres */}
          <div className="grid grid-cols-2 gap-1 bg-muted/20 rounded-lg p-1.5 items-end justify-items-center">
            <div className="flex flex-col items-center p-1 rounded-lg w-full">
              <WorkloadSphere load={pct(weekTotalH, maxWeek)} size={44} label="Settimana" />
            </div>
            <div className="flex flex-col items-center p-1 rounded-lg w-full">
              <WorkloadSphere load={pct(monthTotalH, maxMonth)} size={44} label="Mese" />
            </div>
          </div>

          {/* Week bar */}
          <WorkloadBar
            hours={weekBaseHours}
            preview={inWeek ? previewHours : 0}
            max={maxWeek}
            label={`Settimana (${format(sowRef, 'd MMM', { locale: it })} – ${format(eowRef, 'd MMM', { locale: it })})`}
          />

          {/* Month bar */}
          <WorkloadBar
            hours={monthBaseHours}
            preview={inMonth ? previewHours : 0}
            max={maxMonth}
            label={`${format(somRef, 'MMMM yyyy', { locale: it }).replace(/^\w/, (c) => c.toUpperCase())} (${workDaysMonth}gg)`}
          />
        </div>

      </div>
    </div>
  );
}
