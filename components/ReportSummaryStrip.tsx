"use client"

import React, { useState } from 'react'
import { AlertTriangle, ChevronDown, Coins, Target, Wallet } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { summarizeReport, ALERT_THRESHOLD_PCT, type ReportAlert } from '@/lib/report-metrics'
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

const numFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2, useGrouping: 'always' })

function Tile({ icon: Icon, label, children, hint, onClick, open }: { icon: any; label: string; children: React.ReactNode; hint?: string; onClick?: () => void; open?: boolean }) {
  const Wrapper: any = onClick ? 'button' : 'div'
  return (
    <Wrapper
      {...(onClick ? { type: 'button', onClick, 'aria-expanded': open } : {})}
      className={`flex flex-col gap-1 px-5 py-4 text-left ${onClick ? 'cursor-pointer transition-colors hover:bg-muted/50' : ''}`}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon size={13} /> {label}</p>
      <div className="flex items-baseline gap-2 text-2xl font-bold tabular-nums text-foreground">{children}</div>
      {hint && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {hint}
          {onClick && <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />}
        </p>
      )}
    </Wrapper>
  )
}

/** L'elenco di cosa si è mosso: prima le variazioni negative, poi le positive, ciascuna con piattaforma, metrica e da/a. */
function AlertList({ alerts, compare }: { alerts: ReportAlert[]; compare: 'prev_period' | 'prev_year' }) {
  const sorted = [...alerts].sort((a, b) => Number(a.good) - Number(b.good) || Math.abs(b.value) - Math.abs(a.value))
  return (
    <div className="border-t border-border bg-muted/30 px-5 py-4">
      <p className="mb-3 text-xs text-muted-foreground">
        Metriche cambiate di oltre il {ALERT_THRESHOLD_PCT}% rispetto {compare === 'prev_year' ? "allo stesso periodo dell'anno scorso" : 'al periodo precedente'}. Per costi e spesa, un aumento è negativo.
      </p>
      <ul className="space-y-1.5">
        {sorted.map((a, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
            <span className={`w-16 shrink-0 text-right font-semibold tabular-nums ${a.good ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
              {a.value > 0 ? '+' : '−'}{Math.abs(a.value).toLocaleString('it-IT')}%
            </span>
            <span className="font-medium text-foreground">{a.platform} — {a.label}</span>
            <span className="text-xs text-muted-foreground">da {numFmt.format(a.from)} a {numFmt.format(a.to)}</span>
            <span className={`text-xs font-semibold ${a.good ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>{a.good ? 'migliorata' : 'peggiorata'}</span>
          </li>
        ))}
      </ul>
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
  const [showAlerts, setShowAlerts] = useState(false)

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
        <Tile
          icon={AlertTriangle}
          label={`Variazioni oltre il ${ALERT_THRESHOLD_PCT}%`}
          hint={compared ? (s.alerts.length ? `${bad} peggiorate, ${s.alerts.length - bad} migliorate · vedi quali` : 'Nessuna variazione rilevante') : 'Attiva il confronto per vederle'}
          onClick={compared && s.alerts.length ? () => setShowAlerts((v) => !v) : undefined}
          open={showAlerts}
        >
          <span className={bad > 0 ? 'text-red-700 dark:text-red-400' : ''}>{compared ? s.alerts.length : '—'}</span>
        </Tile>
      </div>
      {compared && showAlerts && s.alerts.length > 0 && <AlertList alerts={s.alerts} compare={compare as 'prev_period' | 'prev_year'} />}
    </div>
  )
}
