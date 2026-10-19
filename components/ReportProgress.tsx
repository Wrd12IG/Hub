"use client"

import React from 'react'
import { progressPercent } from '@/lib/report-warm'
import type { MarketingReportState } from '@/hooks/use-marketing-report'

/**
 * Barra di avanzamento dell'aggiornamento del report: «3 di 7 fonti», con l'ultima completata. Finché il server non ha
 * detto niente è una barra generica (animata); se il report arriva dalla cache non si vede affatto.
 */
export function ReportProgress({ loading, progress, className = '' }: { loading: boolean; progress: MarketingReportState['progress']; className?: string }) {
  if (!loading) return null
  const pct = progressPercent(progress)
  const text = progress && progress.total > 0
    ? `Aggiorno i dati: ${progress.done} di ${progress.total} fonti${progress.label ? ` · ultima: ${progress.label}` : ''}`
    : 'Preparo i dati…'
  return (
    <div className={className} role="progressbar" aria-label="Aggiornamento dei dati" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full bg-primary transition-all duration-500 ${pct === 0 ? 'w-1/4 animate-pulse' : ''}`}
          style={pct > 0 ? { width: `${pct}%` } : undefined}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{text}</p>
    </div>
  )
}
