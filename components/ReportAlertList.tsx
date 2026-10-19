"use client"

import React from 'react'
import { AlertCircle } from 'lucide-react'
import { ALERT_THRESHOLD_PCT, type ReportAlert } from '@/lib/report-metrics'

const numFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2, useGrouping: 'always' })
const pctFmt = (v: number) => `${v > 0 ? '+' : '−'}${Math.abs(v).toLocaleString('it-IT')}%`

function Group({ title, tone, alerts }: { title: string; tone: 'bad' | 'good'; alerts: ReportAlert[] }) {
  if (alerts.length === 0) return null
  const color = tone === 'bad' ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'
  const sorted = [...alerts].sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
  return (
    <div>
      <h4 className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${color}`}>{title} ({alerts.length})</h4>
      <ul className="divide-y divide-border rounded-lg border border-border bg-background">
        {sorted.map((a, i) => (
          <li key={i} className="grid grid-cols-[4.75rem_1fr_auto] items-baseline gap-x-4 px-3 py-2 text-sm">
            <span className={`text-right font-bold tabular-nums ${color}`}>{pctFmt(a.value)}</span>
            <span className="min-w-0">
              <span className="font-medium text-foreground">{a.label}</span>
              <span className="ml-2 text-xs text-muted-foreground">{a.platform}</span>
            </span>
            <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
              da {numFmt.format(a.from)} a {numFmt.format(a.to)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Le variazioni oltre il 25% rispetto al periodo di confronto, in due gruppi (peggiorate, migliorate), ciascuna con
 * metrica, piattaforma e valori da/a. Per costi e spesa un aumento è una variazione peggiorativa.
 */
export function ReportAlertList({ alerts, compare }: { alerts: ReportAlert[]; compare: 'prev_period' | 'prev_year' }) {
  const bad = alerts.filter((a) => !a.good)
  const good = alerts.filter((a) => a.good)
  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
          <AlertCircle size={15} className="text-amber-500" />
          Variazioni oltre il {ALERT_THRESHOLD_PCT}% ({compare === 'prev_year' ? "vs anno prec." : 'vs periodo prec.'})
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Contano solo le metriche con abbastanza volume nel periodo precedente. Per costi e spesa, un aumento è peggiorativo.
        </p>
      </div>
      {alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessuna variazione oltre il {ALERT_THRESHOLD_PCT}% sulle metriche monitorate. Operatività regolare.</p>
      ) : (
        <>
          <Group title="Peggiorate" tone="bad" alerts={bad} />
          <Group title="Migliorate" tone="good" alerts={good} />
        </>
      )}
    </div>
  )
}
