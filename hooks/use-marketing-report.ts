"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlatformReport } from '@/lib/reporting'

/** Periodo della pagina (in giorni) → date_preset del report. */
function toDatePreset(daysBack?: number): string {
  switch (daysBack) {
    case 7: return 'last_7d'
    case 60: return 'last_60d'
    case 90: return 'last_90d'
    case 180: return 'last_180d'
    default: return 'last_30d'
  }
}

export interface MarketingReportState {
  platforms: PlatformReport[] | null
  loading: boolean
  error: string | null
  computedAt: string | null
  fromCache: boolean
  /** A che punto è il calcolo in corso (null finché il server non ha detto niente o se la risposta arriva dalla cache). */
  progress: { done: number; total: number; label: string } | null
  /** `force` salta la cache lato server: l'apertura della pagina non lo usa, «Aggiorna» sì. */
  reload: (force?: boolean) => Promise<void>
}

/**
 * Il report delle piattaforme di un cliente, caricato UNA volta per la pagina e condiviso fra il riepilogo in alto
 * e le schede in basso (prima lo caricava solo la sezione, e il riepilogo non poteva esistere).
 */
export function useMarketingReport(clientId: string, daysBack: number, compare: 'prev_period' | 'prev_year' | 'none', enabled = true, range?: { from: string; to: string } | null): MarketingReportState {
  const [platforms, setPlatforms] = useState<PlatformReport[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [computedAt, setComputedAt] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [progress, setProgress] = useState<MarketingReportState['progress']>(null)
  const poll = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopPolling = () => { if (poll.current) { clearInterval(poll.current); poll.current = null } }

  const reload = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    setProgress(null)
    // Identificativo di questo calcolo: il server scrive l'avanzamento sotto di esso, qui lo si legge ogni poco
    const runId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
    const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` }
    stopPolling()
    poll.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/clients/${clientId}/reporting/progress?run=${runId}`, { headers })
        const j = r.ok ? await r.json() : null
        const p = j?.progress
        if (p && p.total > 0) setProgress({ done: p.done, total: p.total, label: p.steps?.[p.steps.length - 1]?.label ?? '' })
      } catch { /* l'avanzamento è un extra: se non risponde, la barra resta generica */ }
    }, 1200)
    try {
      const res = await fetch(
        `/api/clients/${clientId}/reporting?${range ? `from=${range.from}&to=${range.to}` : `date_preset=${toDatePreset(daysBack)}&days=${daysBack}`}&compare=${compare}&run=${runId}${force ? '&refresh=1' : ''}`,
        { headers },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Errore ${res.status}`)
      }
      const data = await res.json()
      setPlatforms(data.platforms || [])
      setComputedAt(data.computedAt ?? null)
      setFromCache(!!data.cached)
    } catch (err: any) {
      setError(err.message || 'Impossibile caricare il report')
    } finally {
      stopPolling()
      setLoading(false)
    }
  }, [clientId, daysBack, compare, range?.from, range?.to])

  // Solo quando serve (tab Panoramica aperta): il server lo tiene in cache, ma non c'è motivo di chiederlo dalle altre tab
  useEffect(() => { if (enabled) reload(false) }, [reload, enabled])
  useEffect(() => stopPolling, [])

  return { platforms, loading, error, computedAt, fromCache, progress, reload }
}
