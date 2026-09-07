'use client';

import React, { useMemo } from 'react';
import { format, isToday, isYesterday, isTomorrow, addDays, subDays } from 'date-fns';
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
        Seleziona un utente per vedere il carico di lavoro (giorno prima, scelto e giorno dopo)
      </div>
    );
  }

  // Define 3 days: D - 1, D, D + 1
  const days = [
    { key: 'prev' as const, date: subDays(baseDate, 1), isSelected: false },
    { key: 'curr' as const, date: baseDate, isSelected: true },
    { key: 'next' as const, date: addDays(baseDate, 1), isSelected: false },
  ];

  // Active tasks for this user
  const activeTasks = allTasks.filter(
    (t) =>
      t.assignedUserId === userId &&
      t.status !== 'Approvato' &&
      t.status !== 'Annullato' &&
      t.id !== excludeTaskId
  );

  // Calendar activities for this user
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
    return new Date();
  };

  const inRange = (d: Date, start: Date, end: Date) => d >= start && d <= end;

  const WORK_HOURS_DAY = 8;
  const pct = (val: number, max: number) => Math.min((val / max) * 100, 100);
  const color = (p: number) => (p < 60 ? '#22c55e' : p < 85 ? '#f59e0b' : '#ef4444');
  const badge = (p: number) => (p < 60 ? 'Libero' : p < 85 ? 'Quasi pieno' : 'Sovraccarico');

  // Compute stats for each day
  const dayStats = days.map((dayItem) => {
    const { date, isSelected, key } = dayItem;
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

    // Task hours
    const dayTaskHours = activeTasks
      .filter((t) => inRange(taskRefDate(t), startOfDay, endOfDay))
      .reduce((acc, t) => acc + (t.estimatedDuration || 0) / 60, 0);

    // Calendar activity hours
    const dayActivityHours = userActivities
      .filter((a) => {
        const s = new Date(a.startTime || (a as any).start);
        return inRange(s, startOfDay, endOfDay);
      })
      .reduce((acc, a) => {
        const s = new Date(a.startTime || (a as any).start).getTime();
        const e = new Date(a.endTime || (a as any).end).getTime();
        const durHours = Math.max(0, (e - s) / (1000 * 3600));
        return acc + durHours;
      }, 0);

    const baseHours = dayTaskHours + dayActivityHours;
    const dayPreview = isSelected ? Math.max(0, previewHours) : 0;
    const totalHours = baseHours + dayPreview;
    const loadPct = pct(totalHours, WORK_HOURS_DAY);

    // Format labels
    const formattedDate = format(date, 'd MMM', { locale: it });
    const dayName = format(date, 'EEE', { locale: it });
    const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

    let fullLabel = `${capitalizedDay} ${formattedDate}`;
    let sphereLabel = `${capitalizedDay} ${formattedDate}`;

    if (key === 'curr') {
      fullLabel = `Giorno Scelto (${capitalizedDay} ${formattedDate})`;
      sphereLabel = isToday(date) ? `Oggi (${formattedDate})` : `Scelto (${formattedDate})`;
    } else if (key === 'prev') {
      fullLabel = isYesterday(date) ? `Ieri (${capitalizedDay} ${formattedDate})` : `Giorno Prima (${capitalizedDay} ${formattedDate})`;
      sphereLabel = isYesterday(date) ? `Ieri (${formattedDate})` : `Prima (${formattedDate})`;
    } else if (key === 'next') {
      fullLabel = isTomorrow(date) ? `Domani (${capitalizedDay} ${formattedDate})` : `Giorno Dopo (${capitalizedDay} ${formattedDate})`;
      sphereLabel = isTomorrow(date) ? `Domani (${formattedDate})` : `Dopo (${formattedDate})`;
    }

    return {
      key,
      date,
      isSelected,
      baseHours,
      preview: dayPreview,
      totalHours,
      loadPct,
      fullLabel,
      sphereLabel,
    };
  });

  const hasPreview = previewHours > 0;

  return (
    <div className="mt-3 p-3.5 rounded-xl border bg-card/60 backdrop-blur-sm text-xs shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <span className="text-sm">⏱</span>
          <span>Carico Utente (3 Giorni)</span>
        </div>
        {hasPreview && (
          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
            + {previewHours >= 1 ? `${previewHours.toFixed(1)}h` : `${Math.round(previewHours * 60)} min`} in anteprima
          </span>
        )}
      </div>

      {/* 3 Workload Spheres */}
      <div className="grid grid-cols-3 gap-2 py-1 items-end justify-items-center bg-muted/20 rounded-lg p-2">
        {dayStats.map((stat) => (
          <div
            key={stat.key}
            className={`flex flex-col items-center p-1.5 rounded-lg w-full transition-all ${
              stat.isSelected
                ? 'bg-primary/5 ring-1 ring-primary/30 shadow-xs'
                : 'opacity-90'
            }`}
          >
            <WorkloadSphere
              load={stat.loadPct}
              size={stat.isSelected ? 48 : 42}
              label={stat.sphereLabel}
            />
            {stat.isSelected && (
              <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-primary px-1.5 py-0.2 rounded-full bg-primary/10">
                Selezionato
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 3 Workload Progress Bars */}
      <div className="space-y-2 pt-1">
        {dayStats.map((stat) => {
          const pBase = pct(stat.baseHours, WORK_HOURS_DAY);
          const pTotal = pct(stat.totalHours, WORK_HOURS_DAY);
          const cBase = color(pBase);
          const cTotal = color(pTotal);
          const dayHasPreview = stat.preview > 0;

          return (
            <div
              key={stat.key}
              className={`p-2 rounded-lg border transition-all ${
                stat.isSelected
                  ? 'bg-background border-primary/30 shadow-xs'
                  : 'bg-muted/10 border-border/50'
              }`}
            >
              <div className="flex justify-between items-center mb-1 text-[11px]">
                <span className={`flex items-center gap-1.5 font-medium ${stat.isSelected ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                  {stat.isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />}
                  {stat.fullLabel}
                </span>
                <span className="flex items-center gap-1 font-semibold tabular-nums" style={{ color: dayHasPreview ? cTotal : cBase }}>
                  {dayHasPreview ? (
                    <>
                      {stat.baseHours.toFixed(1)}
                      <span style={{ color: cTotal, opacity: 0.9 }}>+{stat.preview.toFixed(1)}</span>
                      h / {WORK_HOURS_DAY}h
                    </>
                  ) : (
                    <>{stat.baseHours.toFixed(1)}h / {WORK_HOURS_DAY}h</>
                  )}
                  <span className="ml-1 text-[10px] font-normal opacity-75">({badge(pTotal)})</span>
                </span>
              </div>

              {/* Progress bar with preview */}
              <div className="relative w-full h-2 rounded-full bg-secondary/80 overflow-hidden">
                {/* Existing base workload */}
                <div
                  className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
                  style={{ width: `${pBase}%`, backgroundColor: cBase }}
                />
                {/* Preview segment */}
                {dayHasPreview && (
                  <div
                    className="absolute top-0 h-full rounded-r-full transition-all duration-300"
                    style={{
                      left: `${pBase}%`,
                      width: `${Math.min(pct(stat.preview, WORK_HOURS_DAY), 100 - pBase)}%`,
                      backgroundColor: cTotal,
                      opacity: 0.6,
                      backgroundImage:
                        'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.4) 3px, rgba(255,255,255,0.4) 5px)',
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
