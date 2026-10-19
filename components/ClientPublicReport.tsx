"use client"

import React from 'react'
import { Coins, MessageSquareText, Target, Wallet } from 'lucide-react'
import { ReportTrendChart } from '@/components/ReportTrendChart'
import { formatEuro } from '@/lib/format'
import { monthLabel } from '@/lib/monthly-comment'
import { PUBLIC_PERIODS, type PublicClientReport } from '@/lib/client-report-public'

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

function Tile({ icon: Icon, label, hint, children }: { icon: any; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon size={13} /> {label}</p>
      <div className="flex items-baseline gap-2 text-2xl font-bold tabular-nums text-foreground">{children}</div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** Risultati e commento mensile, come li vede il cliente dal link pubblico. Riceve già i soli dati adatti al cliente. */
export function ClientPublicReport({
  data, days, onChangeDays, loading,
}: { data: PublicClientReport; days: number; onChangeDays: (d: number) => void; loading: boolean }) {
  const { summary, trend, comment } = data
  const label = summary.result ? summary.result.label.charAt(0).toUpperCase() + summary.result.label.slice(1) : 'Risultato'
  const empty = !summary.spend && !summary.result

  return (
    <section className="space-y-5" aria-busy={loading}>
      {comment && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="mb-1 flex items-center gap-2 text-base font-extrabold tracking-tight text-foreground">
            <MessageSquareText size={16} className="text-primary" /> Il commento del mese
          </h2>
          <p className="mb-3 text-xs capitalize text-muted-foreground">{monthLabel(comment.month)}</p>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{comment.text}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-tight text-foreground">Risultati</h2>
        <div className="inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold" role="tablist" aria-label="Periodo">
          {PUBLIC_PERIODS.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={days === d}
              onClick={() => onChangeDays(d)}
              className={`cursor-pointer rounded-md px-3 py-1.5 transition-colors ${days === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {d} giorni
            </button>
          ))}
        </div>
      </div>

      <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
        {empty ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nessun dato disponibile per questo periodo.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="grid grid-cols-1 divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
                <Tile icon={Wallet} label="Spesa pubblicitaria" hint="Meta + Google Ads">
                  {summary.spend ? <><span>{formatEuro(summary.spend.value)}</span><Delta current={summary.spend.value} previous={summary.spend.previous} inverse /></> : <span>—</span>}
                </Tile>
                <Tile icon={Target} label={label} hint={summary.result?.source}>
                  {summary.result ? <><span>{intFmt.format(summary.result.value)}</span><Delta current={summary.result.value} previous={summary.result.previous} /></> : <span>—</span>}
                </Tile>
                <Tile icon={Coins} label={summary.result ? `Costo per ${summary.result.label}` : 'Costo per risultato'}>
                  <span>{summary.costPerResult === null ? '—' : formatEuro(summary.costPerResult)}</span>
                </Tile>
              </div>
            </div>

            {trend && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h3 className="mb-3 text-base font-extrabold tracking-tight text-foreground">Andamento giornaliero</h3>
                <ReportTrendChart points={trend.points} resultLabel={trend.resultLabel} />
              </div>
            )}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">Variazioni rispetto ai {days} giorni precedenti.</p>
    </section>
  )
}
