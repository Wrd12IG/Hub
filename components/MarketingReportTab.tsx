"use client"

import React, { useEffect, useState, useCallback } from 'react'
import { RefreshCw, TrendingUp, Instagram, Facebook, Search as SearchIcon, Linkedin, AlertCircle, Settings2 } from 'lucide-react'
import { MetricoolCard } from '@/components/metricool/MetricoolCard'
import { Skeleton } from '@/components/ui/skeleton'
import { useLayoutData } from '@/app/(app)/layout-context'

// Matches lib/reporting.ts's PlatformReport shape.
type PlatformKey = 'facebook' | 'instagram' | 'google_ads' | 'ga4' | 'searchconsole' | 'linkedin_organic'

interface PlatformReport {
  platform: PlatformKey
  connected: boolean
  error?: string
  rows: Record<string, string | number | undefined>[]
}

interface WindsorAccounts {
  facebook?: string
  instagram?: string
  google_ads?: string
  ga4?: string
  searchconsole?: string
  linkedin_organic?: string
}

const PLATFORM_META: Record<PlatformKey, { label: string; icon: any; variant: 'blue' | 'orange' | 'green' | 'pink' | 'purple' | 'gray'; metrics: { key: string; label: string }[] }> = {
  facebook: { label: 'Meta Ads', icon: Facebook, variant: 'blue', metrics: [{ key: 'spend', label: 'Spesa €' }, { key: 'clicks', label: 'Click' }, { key: 'impressions', label: 'Impression' }, { key: 'ctr', label: 'CTR' }] },
  instagram: { label: 'Instagram', icon: Instagram, variant: 'pink', metrics: [{ key: 'followers', label: 'Follower' }, { key: 'reach', label: 'Reach' }, { key: 'profile_views', label: 'Visite profilo' }] },
  google_ads: { label: 'Google Ads', icon: TrendingUp, variant: 'green', metrics: [{ key: 'cost', label: 'Spesa €' }, { key: 'clicks', label: 'Click' }, { key: 'conversions', label: 'Conversioni' }, { key: 'ctr', label: 'CTR' }] },
  ga4: { label: 'Google Analytics 4', icon: TrendingUp, variant: 'purple', metrics: [{ key: 'sessions', label: 'Sessioni' }, { key: 'activeUsers', label: 'Utenti attivi' }, { key: 'conversions', label: 'Conversioni' }, { key: 'totalRevenue', label: 'Revenue €' }] },
  searchconsole: { label: 'Search Console', icon: SearchIcon, variant: 'gray', metrics: [{ key: 'clicks', label: 'Click organici' }, { key: 'impressions', label: 'Impression' }, { key: 'position', label: 'Posizione media' }] },
  linkedin_organic: { label: 'LinkedIn', icon: Linkedin, variant: 'blue', metrics: [{ key: 'impressions', label: 'Impression' }, { key: 'clicks', label: 'Click' }, { key: 'likes', label: 'Like' }] },
}

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}` }
}

export function MarketingReportTab({ clientId }: { clientId: string }) {
  const { currentUser } = useLayoutData()
  const isStaff = currentUser?.role !== 'Cliente'

  const [platforms, setPlatforms] = useState<PlatformReport[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

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
          <h2 className="text-lg font-bold">Report Marketing</h2>
          <p className="text-sm text-muted-foreground">Dati aggregati da Windsor.ai — ultimi 30 giorni</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchReport}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border hover:bg-muted transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Aggiorna
          </button>
          {isStaff && (
            <button
              onClick={() => setShowSettings(s => !s)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border hover:bg-muted transition-colors"
            >
              <Settings2 size={14} /> Collega account
            </button>
          )}
        </div>
      </div>

      {isStaff && showSettings && (
        <WindsorAccountsForm clientId={clientId} onSaved={() => { setShowSettings(false); fetchReport() }} />
      )}

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
            {isStaff ? 'Collega almeno un account Windsor.ai per questo cliente per vedere i primi dati.' : 'Il tuo referente sta ancora configurando la reportistica.'}
          </p>
        </div>
      )}

      {!loading && !loadError && platforms && platforms.length > 0 && (
        <div className="space-y-8">
          {platforms.map((p) => {
            const meta = PLATFORM_META[p.platform]
            const row = p.rows[0] || {}
            return (
              <div key={p.platform} className="space-y-3">
                <div className="flex items-center gap-2">
                  <meta.icon size={18} />
                  <h3 className="font-semibold">{meta.label}</h3>
                  {!p.connected && <span className="text-xs text-red-600">Errore: {p.error}</span>}
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
          <p className="text-xs text-muted-foreground pt-2">{connectedCount} di {platforms.length} piattaforme con dati disponibili.</p>
        </div>
      )}
    </div>
  )
}

/** Staff-only inline form to map this client's Windsor.ai account ids per platform. */
function WindsorAccountsForm({ clientId, onSaved }: { clientId: string; onSaved: () => void }) {
  const [values, setValues] = useState<WindsorAccounts>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/clients/${clientId}`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setValues({
        facebook: data.metaAdAccountId || data.windsorAccounts?.facebook || '',
        google_ads: data.googleAdAccountId || data.windsorAccounts?.google_ads || '',
        ga4: data.ga4PropertyId || data.windsorAccounts?.ga4 || '',
        instagram: data.windsorAccounts?.instagram || '',
        searchconsole: data.windsorAccounts?.searchconsole || '',
        linkedin_organic: data.windsorAccounts?.linkedin_organic || '',
      }))
      .catch(() => {})
  }, [clientId])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      // facebook/google_ads/ga4 reuse the client's existing platform-id fields
      // (already used by Setup API / PlatformConnections) rather than duplicating
      // them — only instagram/searchconsole/linkedin_organic are Windsor-only.
      const res = await fetch(`/api/clients/${clientId}`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaAdAccountId: values.facebook,
          googleAdAccountId: values.google_ads,
          ga4PropertyId: values.ga4,
          windsorAccounts: {
            instagram: values.instagram,
            searchconsole: values.searchconsole,
            linkedin_organic: values.linkedin_organic,
          },
        }),
      })
      if (!res.ok) throw new Error('Salvataggio fallito')
      onSaved()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const fields: { key: keyof WindsorAccounts; label: string; hint: string }[] = [
    { key: 'facebook', label: 'Meta Ads — Account ID', hint: 'es. 2531167240443137' },
    { key: 'instagram', label: 'Instagram — Business Account ID', hint: 'es. 17841403614009161' },
    { key: 'google_ads', label: 'Google Ads — Customer ID', hint: 'es. 457-802-1266' },
    { key: 'ga4', label: 'GA4 — Property ID', hint: 'es. 467876662' },
    { key: 'searchconsole', label: 'Search Console — URL sito verificato', hint: 'es. https://www.esempio.it/' },
    { key: 'linkedin_organic', label: 'LinkedIn — Organization ID', hint: 'es. 53113725' },
  ]

  return (
    <div className="p-4 border rounded-xl bg-muted/30 space-y-3">
      <p className="text-xs text-muted-foreground">
        Gli ID si trovano nel pannello Windsor.ai (onboard.windsor.ai) sotto ogni connector collegato. Meta/Google Ads/GA4 sono condivisi con la tab "Setup API". Lascia vuoto un campo per non collegare quella piattaforma.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map(f => (
          <div key={f.key} className="space-y-1">
            <label htmlFor={`windsor-${f.key}`} className="text-xs font-semibold text-muted-foreground">{f.label}</label>
            <input
              id={`windsor-${f.key}`}
              value={values[f.key] || ''}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              placeholder={f.hint}
              className="w-full text-sm bg-background border px-3 py-2 rounded-lg outline-none focus:border-blue-500/50"
            />
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        onClick={save}
        disabled={saving}
        className="text-sm px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold disabled:opacity-50"
      >
        {saving ? 'Salvataggio…' : 'Salva mappatura'}
      </button>
    </div>
  )
}
