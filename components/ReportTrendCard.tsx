"use client"

import React from 'react'
import { ReportTrendChart } from '@/components/ReportTrendChart'
import { computeClientHealth } from '@/lib/client-health'
import { buildTrend, type DailyPoint } from '@/lib/report-series'
import type { MarketingReportState } from '@/hooks/use-marketing-report'

const spendOnly = (s: DailyPoint[] = []): DailyPoint[] => s.map((p) => ({ date: p.date, spend: p.spend }))

/**
 * Andamento giornaliero in Panoramica, subito sotto il riepilogo: spiega se un +240% è un picco o una crescita costante.
 * Usa lo stesso risultato del riepilogo (lead di Meta o conversioni di Google Ads); se l'esito del cliente viene da un altro
 * canale (es. contatti GBP) mostra solo la spesa.
 */
export function ReportTrendCard({ report, days }: { report: MarketingReportState; days: number }) {
  const { platforms } = report
  if (!platforms) return null

  const meta = platforms.find((p) => p.platform === 'facebook' && p.connected)?.series
  const google = platforms.find((p) => p.platform === 'google_ads' && p.connected)?.series
  if (!meta?.length && !google?.length) return null

  const health = computeClientHealth({ platforms, days })
  const source = health.sourcePlatform === 'facebook' ? meta : health.sourcePlatform === 'google_ads' ? google : undefined
  const others = health.sourcePlatform === 'facebook' ? spendOnly(google) : health.sourcePlatform === 'google_ads' ? spendOnly(meta) : [...spendOnly(meta), ...spendOnly(google)]
  const withResults = !!source?.length
  const points = buildTrend(source ?? [], others, withResults)
  if (points.length === 0) return null

  const label = withResults && health.metricLabel ? health.metricLabel.charAt(0).toUpperCase() + health.metricLabel.slice(1) : 'Risultato'

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-extrabold tracking-tight text-foreground">Andamento giornaliero</h3>
        <p className="text-xs text-muted-foreground">
          Spesa{withResults ? ` e ${label.toLowerCase()}` : ''} giorno per giorno, ultimi {days} giorni · {points.length} giorni con dati
        </p>
      </div>
      <ReportTrendChart points={points} resultLabel={label} />
    </div>
  )
}
