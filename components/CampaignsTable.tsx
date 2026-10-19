"use client"

import React from 'react'
import { BarChart2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatEuro } from '@/lib/format'
import { summarizeCampaigns, rowMetrics } from '@/lib/campaign-metrics'

export interface CampaignListRow {
  id: string
  platform: 'meta' | 'google_ads'
  name: string
  status: 'active' | 'paused' | 'ended'
  objective?: string
  startDate?: string
  endDate?: string
  spend: number
  impressions: number
  clicks: number
  conversions: number
}

const STATUS: Record<CampaignListRow['status'], { label: string; className: string }> = {
  active: { label: 'Attiva', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300' },
  paused: { label: 'In pausa', className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300' },
  ended: { label: 'Finita', className: 'bg-slate-200 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300' },
}

// Intl 'it-IT' non raggruppa le migliaia a 4 cifre ("9000"): useGrouping 'always' come formatEuro
const intFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' })
const int = (n: number) => intFmt.format(n)
const pct = (n?: number) => (n === undefined ? '—' : `${n.toLocaleString('it-IT', { maximumFractionDigits: 2 })}%`)
const eur = (n?: number) => (n === undefined ? '—' : formatEuro(n))

const day = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : ''
const period = (c: CampaignListRow) => {
  const from = day(c.startDate)
  const to = day(c.endDate)
  return from && to ? `${from} → ${to}` : from ? `dal ${from}` : to ? `fino al ${to}` : ''
}

const th = 'px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap'
const num = 'px-4 py-3 text-right tabular-nums whitespace-nowrap'

/**
 * Elenco campagne: intestazione leggibile nel tema (era una barra nera con testo scuro), numeri allineati a destra,
 * una riga sola per campagna, e il riepilogo del filtro in testa e in coda. Medie sempre ricalcolate dai totali.
 */
export function CampaignsTable({
  rows,
  loadingReportId,
  onOpenReport,
}: {
  rows: CampaignListRow[]
  loadingReportId: string | null
  onOpenReport: (c: CampaignListRow) => void
}) {
  const total = summarizeCampaigns(rows)
  const stats = [
    { label: 'Spesa', value: formatEuro(total.spend) },
    { label: 'Conversioni', value: int(Math.round(total.conversions)) },
    { label: 'Costo per conversione', value: eur(total.costPerConversion) },
    { label: 'CTR', value: pct(total.ctr) },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="grid grid-cols-2 divide-x divide-border border-b border-border sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="px-5 py-4">
            <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className={th}>Campagna</th>
              <th className={th}>Stato</th>
              <th className={cn(th, 'text-right')}>Spesa</th>
              <th className={cn(th, 'text-right')}>Impression</th>
              <th className={cn(th, 'text-right')}>Click</th>
              <th className={cn(th, 'text-right')}>CTR</th>
              <th className={cn(th, 'text-right')}>CPC</th>
              <th className={cn(th, 'text-right')}>Conv.</th>
              <th className={cn(th, 'text-right')}>Costo/conv.</th>
              <th className={cn(th, 'text-right')}>Report</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const m = rowMetrics(c)
              const s = STATUS[c.status] ?? STATUS.ended
              const loading = loadingReportId === c.id
              return (
                <tr key={`${c.platform}-${c.id}`} className="border-t border-border transition-colors hover:bg-muted/50">
                  <td className="max-w-[340px] px-4 py-3">
                    <p className="truncate font-semibold text-foreground" title={c.name}>{c.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.platform === 'meta' ? 'Meta Ads' : 'Google Ads'}
                      {period(c) && ` · ${period(c)}`}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', s.className)}>{s.label}</span>
                  </td>
                  <td className={cn(num, 'font-semibold text-foreground')}>{formatEuro(c.spend)}</td>
                  <td className={num}>{int(c.impressions)}</td>
                  <td className={num}>{int(c.clicks)}</td>
                  <td className={num}>{pct(m.ctr)}</td>
                  <td className={num}>{eur(m.cpc)}</td>
                  <td className={cn(num, 'font-semibold text-foreground')}>{int(Math.round(c.conversions))}</td>
                  <td className={num}>{eur(m.costPerConversion)}</td>
                  <td className="px-4 py-3 text-right">
                    {c.platform === 'meta' ? (
                      <button
                        type="button"
                        onClick={() => onOpenReport(c)}
                        disabled={loading}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      >
                        {loading ? <Loader2 size={13} className="animate-spin" /> : <BarChart2 size={13} />}
                        {loading ? 'Carico…' : 'KPI'}
                      </button>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-10 bg-muted font-semibold text-foreground">
            <tr className="border-t border-border">
              <td className="px-4 py-3" colSpan={2}>Totale ({rows.length} {rows.length === 1 ? 'campagna' : 'campagne'})</td>
              <td className={num}>{formatEuro(total.spend)}</td>
              <td className={num}>{int(total.impressions)}</td>
              <td className={num}>{int(total.clicks)}</td>
              <td className={num}>{pct(total.ctr)}</td>
              <td className={num}>{eur(total.cpc)}</td>
              <td className={num}>{int(Math.round(total.conversions))}</td>
              <td className={num}>{eur(total.costPerConversion)}</td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
