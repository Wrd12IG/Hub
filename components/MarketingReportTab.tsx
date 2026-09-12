"use client"

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { RefreshCw, TrendingUp, Instagram, Facebook, Search as SearchIcon, Linkedin, AlertCircle, ArrowUpRight, MapPin } from 'lucide-react'
import { MetricoolCard } from '@/components/metricool/MetricoolCard'
import { Skeleton } from '@/components/ui/skeleton'

// Matches lib/reporting.ts's PlatformReport shape.
type PlatformKey = 'facebook' | 'instagram' | 'google_ads' | 'ga4' | 'searchconsole' | 'linkedin_organic' | 'gbp'

interface PlatformReport {
  platform: PlatformKey
  /** Present when a client has several accounts on one platform (GBP: one per sede). */
  accountLabel?: string
  connected: boolean
  error?: string
  rows: Record<string, string | number | undefined>[]
}

// `detail` is the existing per-platform deep-dive page, when one exists — the
// KPI card here is the summary, that page is the drill-down.
const PLATFORM_META: Record<PlatformKey, { label: string; icon: any; variant: 'blue' | 'orange' | 'green' | 'pink' | 'purple' | 'gray'; detail?: string; metrics: { key: string; label: string }[] }> = {
  facebook: { label: 'Meta Ads', icon: Facebook, variant: 'blue', detail: 'meta-ads', metrics: [{ key: 'spend', label: 'Spesa €' }, { key: 'clicks', label: 'Click' }, { key: 'impressions', label: 'Impression' }, { key: 'ctr', label: 'CTR' }] },
  instagram: { label: 'Instagram', icon: Instagram, variant: 'pink', detail: 'instagram', metrics: [{ key: 'followers', label: 'Follower' }, { key: 'reach', label: 'Reach' }, { key: 'profile_views', label: 'Visite profilo' }] },
  google_ads: { label: 'Google Ads', icon: TrendingUp, variant: 'green', detail: 'google-ads', metrics: [{ key: 'cost', label: 'Spesa €' }, { key: 'clicks', label: 'Click' }, { key: 'conversions', label: 'Conversioni' }, { key: 'ctr', label: 'CTR' }] },
  ga4: { label: 'Google Analytics 4', icon: TrendingUp, variant: 'purple', metrics: [{ key: 'sessions', label: 'Sessioni' }, { key: 'activeUsers', label: 'Utenti attivi' }, { key: 'conversions', label: 'Conversioni' }, { key: 'totalRevenue', label: 'Revenue €' }] },
  searchconsole: { label: 'Search Console', icon: SearchIcon, variant: 'gray', metrics: [{ key: 'clicks', label: 'Click organici' }, { key: 'impressions', label: 'Impression' }, { key: 'position', label: 'Posizione media' }] },
  linkedin_organic: { label: 'LinkedIn', icon: Linkedin, variant: 'blue', detail: 'linkedin', metrics: [{ key: 'impressions', label: 'Impression' }, { key: 'clicks', label: 'Click' }, { key: 'likes', label: 'Like' }] },
  gbp: { label: 'Google Business Profile', icon: MapPin, variant: 'green', detail: 'gbp', metrics: [{ key: 'impressions', label: 'Visualizzazioni' }, { key: 'website_clicks', label: 'Click sito' }, { key: 'call_clicks', label: 'Chiamate' }, { key: 'direction_requests', label: 'Indicazioni' }] },
}

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

export function MarketingReportTab({ clientId }: { clientId: string }) {
  const [platforms, setPlatforms] = useState<PlatformReport[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/reporting`, { headers: authHeaders() })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Errore ${res.status}`)
      }
      const data = await res.json()
      setPlatforms(data.platforms || [])
    } catch (err: any) {
      setLoadError(err.message || 'Impossibile caricare il report')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { fetchReport() }, [fetchReport])

  const connectedCount = platforms?.filter(p => p.connected).length ?? 0
  const noPlatformsConfigured = platforms !== null && platforms.length === 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Performance per Account</h2>
          <p className="text-sm text-muted-foreground">
            KPI reali da Windsor.ai — ultimi 30 giorni. Apri &quot;Dettaglio&quot; per la vista completa di un account.
          </p>
        </div>
        <button
          onClick={fetchReport}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border hover:bg-muted transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Aggiorna
        </button>
      </div>

      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      )}

      {!loading && loadError && (
        <div className="flex items-center gap-2 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          <AlertCircle size={16} /> {loadError}
        </div>
      )}

      {!loading && !loadError && noPlatformsConfigured && (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl border-dashed gap-2">
          <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
          <h3 className="font-semibold">Nessuna piattaforma collegata</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Vai nella tab <strong>Setup API</strong> e collega almeno un account (Meta Ads, Google Ads, GA4, Instagram, Search Console o LinkedIn) per vedere i primi dati qui.
          </p>
        </div>
      )}

      {!loading && !loadError && platforms && platforms.length > 0 && (
        <div className="space-y-8">
          {platforms.map((p) => {
            const meta = PLATFORM_META[p.platform]
            const row = p.rows[0] || {}
            return (
              // A platform can appear more than once (GBP: one entry per sede),
              // so the key has to include the account, not just the platform.
              <div key={`${p.platform}-${p.accountLabel ?? 'single'}`} className="space-y-3">
                <div className="flex items-center gap-2">
                  <meta.icon size={18} />
                  <h3 className="font-semibold">{meta.label}</h3>
                  {p.accountLabel && (
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {p.accountLabel}
                    </span>
                  )}
                  {!p.connected && <span className="text-xs text-red-600">Errore: {p.error}</span>}
                  {meta.detail && (
                    <Link
                      href={`/clients/${clientId}/${meta.detail}`}
                      className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Dettaglio <ArrowUpRight size={13} />
                    </Link>
                  )}
                </div>
                {p.connected && p.rows.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {meta.metrics.map(m => (
                      <MetricoolCard key={m.key} title={m.label} value={(row[m.key] as number) ?? 0} variant={meta.variant} />
                    ))}
                  </div>
                ) : p.connected ? (
                  <div className="text-sm text-muted-foreground p-4 border rounded-lg border-dashed">
                    Account collegato correttamente, ma nessuna attività registrata negli ultimi 30 giorni.
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-4 border rounded-lg border-dashed">
                    Dati non disponibili al momento per questa piattaforma.
                  </div>
                )}
              </div>
            )
          })}
          <p className="text-xs text-muted-foreground pt-2">{connectedCount} di {platforms.length} piattaforme con dati disponibili. Per aggiungerne altre, vai in <strong>Setup API</strong>.</p>
        </div>
      )}
    </div>
  )
}
