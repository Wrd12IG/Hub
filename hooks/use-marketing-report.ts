"use client"

import { useCallback, useEffect, useState } from 'react'
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
  /** `force` salta la cache lato server: l'apertura della pagina non lo usa, «Aggiorna» sì. */
  reload: (force?: boolean) => Promise<void>
}

/**
 * Il report delle piattaforme di un cliente, caricato UNA volta per la pagina e condiviso fra il riepilogo in alto
 * e le schede in basso (prima lo caricava solo la sezione, e il riepilogo non poteva esistere).
 */
export function useMarketingReport(clientId: string, daysBack: number, compare: 'prev_period' | 'prev_year' | 'none', enabled = true): MarketingReportState {
  const [platforms, setPlatforms] = useState<PlatformReport[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [computedAt, setComputedAt] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)

  const reload = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/clients/${clientId}/reporting?date_preset=${toDatePreset(daysBack)}&days=${daysBack}&compare=${compare}${force ? '&refresh=1' : ''}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } },
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
      setLoading(false)
    }
  }, [clientId, daysBack, compare])

  // Solo quando serve (tab Panoramica aperta): il server lo tiene in cache, ma non c'è motivo di chiederlo dalle altre tab
  useEffect(() => { if (enabled) reload(false) }, [reload, enabled])

  return { platforms, loading, error, computedAt, fromCache, reload }
}
