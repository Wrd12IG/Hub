"use client"

import React from 'react'
import { Coins, Target, Wallet } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ReportProgress } from '@/components/ReportProgress'
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
 * risultato è arrivato, quanto costa ognuno. Le variazioni oltre il 25% non stanno qui: sono già elencate nelle Performance per
 * account. Calcolata dal report già caricato.
 */
export function ReportSummaryStrip({
  report, days, compare, audience = 'staff',
}: { report: MarketingReportState; days: number; compare: 'prev_period' | 'prev_year' | 'none'; audience?: 'staff' | 'client' }) {
  const forClient = audience === 'client'
  const { platforms, loading, error } = report

  if (!platforms) {
    if (error) return <p className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">{forClient ? 'Il riepilogo non è disponibile al momento. Riprova fra poco.' : `Riepilogo non disponibile: ${error}`}</p>
    return (
      <div className="space-y-3">
        <Skeleton className="h-[92px] rounded-2xl" />
        <ReportProgress loading={loading} progress={report.progress} />
      </div>
    )
  }

  const s = summarizeReport(platforms, days)
  if (!s.spend && !s.result) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        {forClient ? 'Nessun dato di risultato nel periodo selezionato.' : 'Nessun dato di risultato nel periodo: collega una piattaforma da Setup API per vedere qui il riepilogo.'}
      </p>
    )
  }

  const resultLabel = s.result ? s.result.label.charAt(0).toUpperCase() + s.result.label.slice(1) : ''
  const compared = compare !== 'none'

  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
        <Tile icon={Wallet} label="Spesa pubblicitaria" hint="Meta + Google Ads">
          {s.spend ? <><span>{formatEuro(s.spend.value)}</span>{compared && <Delta current={s.spend.value} previous={s.spend.previous} inverse />}</> : <span>—</span>}
        </Tile>
        <Tile icon={Target} label={s.result ? resultLabel : 'Risultato'} hint={s.result?.source}>
          {s.result ? <><span>{intFmt.format(s.result.value)}</span>{compared && <Delta current={s.result.value} previous={s.result.previous} />}</> : <span>—</span>}
        </Tile>
        <Tile icon={Coins} label={s.result ? `Costo per ${s.result.label}` : 'Costo per risultato'} hint={s.costPerResult === null && s.result ? 'Solo per canali a pagamento' : undefined}>
          <span>{s.costPerResult === null ? '—' : formatEuro(s.costPerResult)}</span>
        </Tile>
      </div>
      {loading && (
        <div className="border-t border-border px-5 py-3">
          <ReportProgress loading={loading} progress={report.progress} />
        </div>
      )}
    </div>
  )
}
