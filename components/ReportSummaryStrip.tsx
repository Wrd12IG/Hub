"use client"

import React from 'react'
import { AlertTriangle, Coins, Target, Wallet } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { summarizeReport } from '@/lib/report-metrics'
import { formatEuro } from '@/lib/format'
import type { MarketingReportState } from '@/hooks/use-marketing-report'

const intFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' })

function Delta({ current, previous, inverse = false }: { current: number; previous: number | null; inverse?: boolean }) {
  if (previous === null || previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 1000) / 10
  if (pct === 0) return null
  const good = inverse ? pct < 0 : pct > 0
  return (
    <span className={`text-xs font-semibold ${good ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
      {pct > 0 ? '+' : '−'}{Math.abs(pct).toLocaleString('it-IT')}%
    </span>
  )
}

function Tile({ icon: Icon, label, children, hint }: { icon: any; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon size={13} /> {label}</p>
      <div className="flex items-baseline gap-2 text-2xl font-bold tabular-nums text-foreground">{children}</div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * La riga che deve dire tutto in tre secondi, sempre visibile in cima alla Panoramica: quanto si è speso, quale
 * risultato è arrivato, quanto costa ognuno, se c'è qualcosa che si è mosso. Calcolata dal report già caricato.
 */
export function ReportSummaryStrip({
  report, days, compare,
}: { report: MarketingReportState; days: number; compare: 'prev_period' | 'prev_year' | 'none' }) {
  const { platforms, loading, error } = report

  if (!platforms) {
    if (error) return <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">Riepilogo non disponibile: {error}</p>
    return <Skeleton className="h-[92px] rounded-2xl" />
  }

  const s = summarizeReport(platforms, days)
  if (!s.spend && !s.result) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Nessun dato di risultato nel periodo: collega una piattaforma da Setup API per vedere qui il riepilogo.
      </p>
    )
  }

  const bad = s.alerts.filter((a) => !a.good).length
  const resultLabel = s.result ? s.result.label.charAt(0).toUpperCase() + s.result.label.slice(1) : ''
  const compared = compare !== 'none'

  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      <div className="grid grid-cols-2 divide-border md:grid-cols-4 md:divide-x [&>*:nth-child(-n+2)]:border-b md:[&>*:nth-child(-n+2)]:border-b-0 [&>*]:border-border">
        <Tile icon={Wallet} label="Spesa pubblicitaria" hint="Meta + Google Ads">
          {s.spend ? <><span>{formatEuro(s.spend.value)}</span>{compared && <Delta current={s.spend.value} previous={s.spend.previous} inverse />}</> : <span>—</span>}
        </Tile>
        <Tile icon={Target} label={s.result ? resultLabel : 'Risultato'} hint={s.result?.source}>
          {s.result ? <><span>{intFmt.format(s.result.value)}</span>{compared && <Delta current={s.result.value} previous={s.result.previous} />}</> : <span>—</span>}
        </Tile>
        <Tile icon={Coins} label={s.result ? `Costo per ${s.result.label}` : 'Costo per risultato'} hint={s.costPerResult === null && s.result ? 'Solo per canali a pagamento' : undefined}>
          <span>{s.costPerResult === null ? '—' : formatEuro(s.costPerResult)}</span>
        </Tile>
        <Tile icon={AlertTriangle} label="Anomalie" hint={compared ? (s.alerts.length ? `${bad} negative, ${s.alerts.length - bad} positive` : 'Nessuno scostamento rilevante') : 'Attiva il confronto per vederle'}>
          <span className={bad > 0 ? 'text-red-700 dark:text-red-400' : ''}>{compared ? s.alerts.length : '—'}</span>
        </Tile>
      </div>
    </div>
  )
}
