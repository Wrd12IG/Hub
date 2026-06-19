"use client"

import React, { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, MapPin, MessageSquareHeart, Search,
  FileBarChart, Megaphone, Star, Sparkles, TrendingUp,
  Download, Calendar, Settings, Loader2, AlertCircle,
  Globe, Phone, Navigation, ChevronDown, Plus, Eye,
  RefreshCw, CheckCircle, XCircle, Clock
} from 'lucide-react'
import { toast } from 'sonner'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

// ─── Types ───────────────────────────────────────────────────────────────────

interface GbpLocation {
  id: string
  name: string
  address?: string
}

interface GbpInsights {
  totalImpressions: number
  totalActions: number
  websiteClicks: number
  phoneCalls: number
  directionRequests: number
  impressionChange?: number
}

interface GbpReview {
  author: string
  rating: number
  text: string
  date: string
  replied?: boolean
}

interface GbpReviews {
  totalReviews: number
  unansweredCount: number
  averageRating: number
  recent: GbpReview[]
}

interface GbpKeyword {
  keyword: string
  impressions: number
}

interface GbpData {
  insights?: GbpInsights
  reviews?: GbpReviews
  keywords?: GbpKeyword[]
  healthScore?: number
  healthChecks?: Array<{ label: string; ok: boolean }>
}

interface GbpDashboardProps {
  clientId: string
  locations?: GbpLocation[]
  activeLocationId?: string | null
}

type TabType = 'overview' | 'directories' | 'reviews' | 'seo' | 'reporting' | 'content'

// ─── Helper: Star Rating ──────────────────────────────────────────────────────

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          size={14}
          fill={i < rating ? '#f59e0b' : 'transparent'}
          className={i < rating ? 'text-amber-400' : 'text-muted-foreground/30'}
        />
      ))}
    </div>
  )
}

// ─── Empty / Not Configured State ────────────────────────────────────────────

function NotConfiguredBanner({ onConfigure }: { onConfigure?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-6 py-16">
      <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
        <MapPin className="h-10 w-10 text-amber-400/60" />
      </div>
      <div className="text-center max-w-sm space-y-2">
        <h3 className="text-lg font-bold text-foreground">Google Business Profile Non Configurato</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Collega l'account GBP e seleziona le sedi in <strong>Setup API</strong> per sbloccare i dati di performance Local SEO in tempo reale.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onConfigure}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-400 transition-all active:scale-95"
        >
          <Settings size={15} /> Configura in Setup API
        </button>
      </div>
    </div>
  )
}

// ─── Skeleton Cards ───────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-card p-5 rounded-xl border border-white/5 animate-pulse">
          <div className="h-3 w-20 bg-white/10 rounded mb-3" />
          <div className="h-8 w-16 bg-white/10 rounded mb-2" />
          <div className="h-2.5 w-24 bg-white/5 rounded" />
        </div>
      ))}
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, icon: Icon, change
}: {
  label: string
  value: string
  sub?: string
  color: string
  icon: React.ElementType
  change?: number
}) {
  return (
    <div className="glass-card p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300 hover:-translate-y-0.5 shadow-sm flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-muted-foreground/75 uppercase tracking-wider">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className="text-2xl font-extrabold tracking-tight text-foreground">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground/60">{sub}</div>}
      {change !== undefined && (
        <div className={`text-[10px] font-bold inline-flex items-center gap-0.5 ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          <TrendingUp size={10} className={change < 0 ? 'rotate-180' : ''} />
          {change >= 0 ? '+' : ''}{change}% vs mese prec.
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GbpDashboardTab({
  clientId,
  locations = [],
  activeLocationId,
}: GbpDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [daysBack, setDaysBack] = useState(30)
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    activeLocationId || (locations[0]?.id ?? null)
  )
  const [gbpData, setGbpData] = useState<GbpData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(!!selectedLocationId)

  const fetchGbpData = useCallback(async (locationId: string) => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(
        `${API_URL}/api/clients/${clientId}/gbp?locationId=${locationId}&daysBack=${daysBack}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const json = await res.json()

      if (!res.ok) {
        if (json?.notConfigured || res.status === 503) {
          setConfigured(false)
          setGbpData(null)
          return
        }
        throw new Error(json?.error || `Errore ${res.status}`)
      }

      if (json?.configured === false) {
        setConfigured(false)
        setGbpData(null)
        return
      }

      setConfigured(true)
      setGbpData(json)
    } catch (err: any) {
      setError(err.message || 'Impossibile caricare i dati GBP')
    } finally {
      setLoading(false)
    }
  }, [clientId, daysBack])

  useEffect(() => {
    if (selectedLocationId) {
      setConfigured(true)
      fetchGbpData(selectedLocationId)
    } else {
      setConfigured(false)
    }
  }, [selectedLocationId, fetchGbpData])

  // ─── Tab: Overview ────────────────────────────────────────────────────────

  const renderOverview = () => {
    if (loading) return <KpiSkeleton />
    if (!configured) return <NotConfiguredBanner />
    if (error) return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <AlertCircle className="h-10 w-10 text-rose-400/60" />
        <div>
          <p className="font-bold text-foreground">Errore nel caricamento</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
        <button
          onClick={() => selectedLocationId && fetchGbpData(selectedLocationId)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-all"
        >
          <RefreshCw size={14} /> Riprova
        </button>
      </div>
    )

    // API pending (configured but no data yet from Google)
    if (configured && !gbpData) return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <Clock className="h-8 w-8 text-amber-400/60" />
        </div>
        <div className="max-w-sm space-y-2">
          <h3 className="font-bold text-foreground">GBP Configurato — Dati in attesa</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            L'integrazione con Google Business Profile API è in corso di approvazione. I dati reali verranno mostrati non appena disponibili.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-amber-400 font-bold">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          Sede collegata: {selectedLocationId}
        </div>
      </div>
    )

    const ins = gbpData!.insights
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            label="Impressioni Totali"
            value={ins?.totalImpressions?.toLocaleString('it-IT') ?? '—'}
            icon={Eye}
            color="bg-amber-500/10 text-amber-400"
            change={ins?.impressionChange}
          />
          <KpiCard
            label="Azioni Totali"
            value={ins?.totalActions?.toLocaleString('it-IT') ?? '—'}
            sub={ins ? `${ins.websiteClicks} Click · ${ins.phoneCalls} Chiamate` : undefined}
            icon={TrendingUp}
            color="bg-emerald-500/10 text-emerald-400"
          />
          <KpiCard
            label="Richieste Indicazioni"
            value={ins?.directionRequests?.toLocaleString('it-IT') ?? '—'}
            icon={Navigation}
            color="bg-blue-500/10 text-blue-400"
          />
          <KpiCard
            label="Click Sito Web"
            value={ins?.websiteClicks?.toLocaleString('it-IT') ?? '—'}
            icon={Globe}
            color="bg-violet-500/10 text-violet-400"
          />
        </div>

        {/* Health Score */}
        {gbpData!.healthScore != null && (
          <div className="glass-card p-5 rounded-xl border border-white/5 bg-white/[0.02]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground">SEO Local Score</h3>
              <span className="text-sm font-extrabold text-foreground">{gbpData!.healthScore}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden border border-white/5 mb-3">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${gbpData!.healthScore}%`,
                  background: gbpData!.healthScore! > 70 ? '#10b981' : '#f59e0b'
                }}
              />
            </div>
            {gbpData!.healthChecks && (
              <ul className="flex flex-col gap-1.5">
                {gbpData!.healthChecks.map((check, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                    {check.ok
                      ? <CheckCircle size={13} className="text-emerald-400 flex-shrink-0" />
                      : <XCircle size={13} className="text-rose-400 flex-shrink-0" />
                    }
                    {check.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── Tab: Sedi & Directory ─────────────────────────────────────────────────

  const renderDirectories = () => {
    if (!configured) return <NotConfiguredBanner />
    return (
      <div className="glass-card p-6 rounded-2xl border border-white/5 bg-white/[0.02] space-y-6">
        <div className="flex items-center gap-3">
          <MapPin className="h-5 w-5 text-amber-400" />
          <div>
            <h3 className="font-bold text-foreground">Sedi Collegate</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Gestisci le informazioni NAP (Nome, Indirizzo, Telefono) su tutti i network locali.
            </p>
          </div>
        </div>

        {/* Locations list */}
        <div className="space-y-3">
          {locations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-white/10 rounded-xl">
              Nessuna sede configurata. Vai in <strong>Setup API → GBP</strong> per aggiungere sedi.
            </div>
          ) : (
            locations.map((loc) => (
              <div
                key={loc.id}
                className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                  loc.id === selectedLocationId
                    ? 'border-amber-500/30 bg-amber-500/[0.04]'
                    : 'border-white/5 bg-white/[0.01]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${loc.id === selectedLocationId ? 'bg-emerald-400' : 'bg-white/20'}`} />
                  <div>
                    <div className="text-sm font-bold text-foreground">{loc.name}</div>
                    {loc.address && <div className="text-xs text-muted-foreground">{loc.address}</div>}
                    <div className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">{loc.id}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {loc.id === selectedLocationId && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      ATTIVA
                    </span>
                  )}
                  <button
                    onClick={() => setSelectedLocationId(loc.id)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    Seleziona
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Directory network sync */}
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Stato Sincronizzazione Network</h4>
          <div className="space-y-2">
            {[
              { name: 'Google Business Profile', status: configured ? 'sync' : 'pending' },
              { name: 'Apple Maps', status: 'pending' },
              { name: 'Bing Places', status: 'pending' },
            ].map((net, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-sm font-medium text-foreground">{net.name}</span>
                {net.status === 'sync'
                  ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">Sincronizzato</span>
                  : <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">In sospeso</span>
                }
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Tab: Recensioni ──────────────────────────────────────────────────────

  const renderReviews = () => {
    if (loading) return <KpiSkeleton />
    if (!configured) return <NotConfiguredBanner />

    const rev = gbpData?.reviews
    if (!rev) return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        <MessageSquareHeart className="h-10 w-10 mx-auto mb-3 opacity-20" />
        Nessuna recensione disponibile — dati in attesa dall'API Google.
      </div>
    )

    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="grid grid-cols-3 gap-4">
          <div className="glass-card p-5 rounded-xl border border-white/5 text-center">
            <div className="text-2xl font-extrabold text-foreground">{rev.totalReviews}</div>
            <div className="text-xs text-muted-foreground mt-1">Totale Recensioni</div>
          </div>
          <div className="glass-card p-5 rounded-xl border border-white/5 text-center">
            <div className="text-2xl font-extrabold text-amber-400">{rev.averageRating.toFixed(1)}</div>
            <StarRating rating={Math.round(rev.averageRating)} />
            <div className="text-xs text-muted-foreground mt-1">Media</div>
          </div>
          <div className="glass-card p-5 rounded-xl border border-rose-500/10 text-center">
            <div className="text-2xl font-extrabold text-rose-400">{rev.unansweredCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Senza Risposta</div>
          </div>
        </div>

        <div className="space-y-3">
          {rev.recent.map((review, i) => (
            <div key={i} className="glass-card p-5 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {review.author.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-foreground">{review.author}</div>
                    <div className="text-[11px] text-muted-foreground">{review.date}</div>
                  </div>
                </div>
                <StarRating rating={review.rating} />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">"{review.text}"</p>
              <div className="flex justify-end pt-1 border-t border-white/5">
                <button className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-all">
                  <Sparkles size={12} /> Genera Risposta AI
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── Tab: Local SEO ───────────────────────────────────────────────────────

  const renderSeo = () => {
    if (!configured) return <NotConfiguredBanner />
    const kws = gbpData?.keywords || []
    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="glass-card p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-amber-400" /> Termini di Ricerca Top
          </h3>
          {kws.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-white/10 rounded-xl">
              Nessun dato keyword disponibile dall'API Google.
            </div>
          ) : (
            <div className="space-y-2">
              {kws.map((kw, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
                  <span className="text-sm font-medium text-foreground">{kw.keyword}</span>
                  <span className="text-sm font-bold text-amber-400">{kw.impressions.toLocaleString('it-IT')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-6 rounded-2xl border border-white/5 bg-white/[0.02]">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-violet-400" /> AI Visibility Tracker
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Funzionalità in sviluppo — monitora la visibilità del brand nei motori AI (ChatGPT, Perplexity, Gemini).
          </p>
          <div className="text-center py-8 border border-dashed border-violet-500/20 rounded-xl text-muted-foreground text-sm">
            <Sparkles className="h-6 w-6 mx-auto mb-2 text-violet-400/40" />
            Disponibile nella prossima release
          </div>
        </div>
      </div>
    )
  }

  // ─── Tab: Reportistica ────────────────────────────────────────────────────

  const renderReporting = () => {
    if (!configured) return <NotConfiguredBanner />
    return (
      <div className="glass-card p-6 rounded-2xl border border-white/5 bg-white/[0.02] space-y-4 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <FileBarChart className="h-5 w-5 text-amber-400" /> Reportistica Automatica
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Genera e invia report PDF brandizzati al cliente con i KPI GBP mensili.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all active:scale-95">
            <Download size={14} /> Genera Report
          </button>
        </div>
        <div className="text-center py-10 border border-dashed border-white/10 rounded-xl text-muted-foreground text-sm">
          <FileBarChart className="h-8 w-8 mx-auto mb-2 opacity-20" />
          I report saranno disponibili quando i dati GBP sono attivi.
        </div>
      </div>
    )
  }

  // ─── Tab: Post & Contenuti ────────────────────────────────────────────────

  const renderContent = () => {
    if (!configured) return <NotConfiguredBanner />
    return (
      <div className="glass-card p-6 rounded-2xl border border-white/5 bg-white/[0.02] space-y-4 animate-in fade-in duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-foreground flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-amber-400" /> Gestione Post & Contenuti
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Crea, programma e pubblica Aggiornamenti, Offerte ed Eventi sulla scheda Google.
            </p>
          </div>
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-400 transition-all active:scale-95">
            <Plus size={14} /> Nuovo Post
          </button>
        </div>
        <div className="text-center py-10 border border-dashed border-white/10 rounded-xl text-muted-foreground text-sm">
          <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-20" />
          Funzionalità disponibile con API GBP attiva.
        </div>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview & KPI', icon: LayoutDashboard },
    { id: 'directories', label: 'Sedi & Directory', icon: MapPin },
    { id: 'reviews', label: 'Recensioni & AI', icon: MessageSquareHeart },
    { id: 'seo', label: 'Local SEO & Competitor', icon: Search },
    { id: 'reporting', label: 'Reportistica', icon: FileBarChart },
    { id: 'content', label: 'Post & Contenuti', icon: Megaphone },
  ]

  return (
    <div className="w-full space-y-5">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            Profilo <span className="text-amber-400">GBP</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Centro di comando Local SEO</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Location selector (only if multiple) */}
          {locations.length > 1 && (
            <div className="relative">
              <select
                value={selectedLocationId ?? ''}
                onChange={(e) => setSelectedLocationId(e.target.value || null)}
                className="text-xs font-semibold pr-8 pl-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-foreground outline-none focus:border-amber-500/50 cursor-pointer appearance-none"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id} className="bg-neutral-900">
                    {loc.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          )}

          {/* Period selector */}
          {activeTab === 'overview' && configured && (
            <select
              value={daysBack}
              onChange={(e) => setDaysBack(Number(e.target.value))}
              className="text-xs font-semibold pr-8 pl-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-foreground outline-none focus:border-primary/50 cursor-pointer appearance-none"
            >
              <option value={7}>Ultimi 7 giorni</option>
              <option value={30}>Ultimi 30 giorni</option>
              <option value={90}>Ultimi 90 giorni</option>
              <option value={180}>Ultimi 6 mesi</option>
              <option value={365}>Ultimo Anno</option>
            </select>
          )}

          {/* Refresh button */}
          {configured && selectedLocationId && (
            <button
              onClick={() => fetchGbpData(selectedLocationId)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Aggiornamento...' : 'Aggiorna'}
            </button>
          )}
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide border-b border-white/5 pb-0">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-t-lg text-xs font-bold whitespace-nowrap transition-all border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="min-h-[300px]">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'directories' && renderDirectories()}
        {activeTab === 'reviews' && renderReviews()}
        {activeTab === 'seo' && renderSeo()}
        {activeTab === 'reporting' && renderReporting()}
        {activeTab === 'content' && renderContent()}
      </div>
    </div>
  )
}
