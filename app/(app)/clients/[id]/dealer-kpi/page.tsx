"use client"

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Activity, AlertTriangle, ArrowRight, BarChart3, CalendarCheck, CalendarDays, Car, Coins, Download, ExternalLink, Eye, FileText,
  Inbox, Info, Loader2, MapPin, Megaphone, MousePointerClick, Phone, RefreshCw, Sheet as SheetIcon, Table2, TrendingDown, TrendingUp, Users, Wallet,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { btn } from '@/app/(app)/outreach/shared'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { funnelRate } from '@/lib/dealer-kpi/totals'
import { clientToCsv, type ClientCsvKpi } from '@/lib/dealer-kpi/overview'
import { formatDelta, formatValue, type KpiResult } from '@/lib/kpi-compute'
import { previousMonthKey, isMonthKey } from '@/lib/manual-kpis'
import { ENTRY_TYPES, SOURCES, TYPE_LABEL, type EntryType, type MonthTotals } from '@/lib/dealer-kpi/types'
import type { SyncStatus } from '@/lib/dealer-kpi/sync'

type KpiPayload = { month: string; profile?: string; profileLabel?: string; groups: { label: string; ids: string[] }[]; kpis: KpiResult[]; alerts: string[]; partial: { days: number } | null; computedAt?: string; cached?: boolean }

type Payload = {
  clientName: string
  kpiProfile?: string | null
  config: { spreadsheetId: string; tab: string; status?: SyncStatus | null } | null
  serviceAccountEmail: string | null
  months: MonthTotals[]
}

const STATUS_CLS: Record<string, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400', avvisi: 'text-amber-600 dark:text-amber-400', errore: 'text-red-600 dark:text-red-400',
}
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const monthLabel = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
const pct = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('it-IT')}%`)
const int = (n: number) => n.toLocaleString('it-IT')
const timeLabel = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '')
/** Il mese in corso (ora locale). Il giorno 1 non ha ancora un giorno chiuso: si parte dal mese prima. */
function defaultMonthKey(now = new Date()): string {
  if (now.getDate() === 1) return previousMonthKey(now)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

/** Un'icona per KPI, così la griglia si legge a colpo d'occhio. */
const KPI_ICON: Record<string, LucideIcon> = {
  sessions: MousePointerClick, users: Users, ads_impressions: Eye, meta_reach: Megaphone, gbp_calls: Phone, gbp_directions: MapPin,
  leads_real: Inbox, cost_per_lead_total: Coins, appointments: CalendarCheck, quotes: FileText, sales: Car,
  meta_impressions: Eye, meta_spend: Wallet, cpl_meta_real: Coins, gads_impressions: Eye, gads_clicks: MousePointerClick,
  gads_conversions: Activity, gads_spend: Wallet, cpl_google: Coins,
}
/** Da dove arriva il numero: sotto il valore, in piccolo. */
const KPI_SOURCE: Record<string, string> = {
  sessions: 'Analytics', users: 'Analytics', ads_impressions: 'Meta + Google Ads', meta_reach: 'Meta Ads', gbp_calls: 'Google Maps', gbp_directions: 'Google Maps',
  leads_real: 'Sheet del cliente', cost_per_lead_total: 'Spesa ÷ lead Google + Meta', appointments: 'Sheet del cliente', quotes: 'Sheet del cliente', sales: 'Sheet del cliente',
  meta_impressions: 'Meta Ads', meta_spend: 'Meta Ads', cpl_meta_real: 'Meta Ads', gads_impressions: 'Google Ads', gads_clicks: 'Google Ads',
  gads_conversions: 'Google Ads', gads_spend: 'Google Ads', cpl_google: 'Google Ads',
}
/** La spiegazione dietro la (i) di ogni KPI: cos'è, da dove viene, come leggerlo. */
const KPI_HELP: Record<string, string> = {
  sessions: 'Le visite al sito nel mese (Google Analytics, «sessioni»). Una persona che torna due volte conta due sessioni.',
  users: 'Le persone diverse che hanno visitato il sito nel mese (Google Analytics, «utenti attivi»). Con più siti non si sommano.',
  ads_impressions: 'Quante volte gli annunci sono stati mostrati, sommando Meta Ads (Facebook e Instagram) e Google Ads. Non sono persone: la stessa persona può vederli più volte.',
  meta_reach: 'Le persone diverse raggiunte dagli annunci Meta (Facebook e Instagram). Solo Meta: Google Ads non dice quante persone ha raggiunto.',
  gbp_calls: 'Le telefonate fatte dal pulsante «Chiama» della scheda Google (Maps e ricerca). Somma di tutte le sedi collegate.',
  gbp_directions: 'Quante volte è stato chiesto il percorso verso la sede dalla scheda Google (Maps e ricerca). Somma di tutte le sedi collegate.',
  leads_real: 'I lead che il cliente ha dichiarato nello Sheet per il mese (righe di tipo «Lead»). Marca e provenienza sono più sotto.',
  cost_per_lead_total: 'Quanto è costato ogni lead delle campagne: spesa Meta Ads + Google Ads del mese, divisa per i lead con provenienza «Meta» e «Google» dello Sheet.',
  appointments: 'Gli appuntamenti dichiarati nello Sheet per il mese (righe di tipo «Appuntamento»).',
  quotes: 'I preventivi dichiarati nello Sheet per il mese (righe di tipo «Preventivo»).',
  sales: 'Le vendite dichiarate nello Sheet per il mese (righe di tipo «Vendita»).',
  meta_impressions: 'Quante volte gli annunci Meta (Facebook e Instagram) sono stati mostrati nel mese.',
  meta_spend: 'La spesa delle campagne Meta Ads nel mese, IVA esclusa.',
  cpl_meta_real: 'Spesa Meta Ads del mese divisa per i lead con provenienza «Meta» dello Sheet.',
  gads_impressions: 'Quante volte gli annunci Google Ads sono stati mostrati nel mese (ricerca, display, YouTube).',
  gads_clicks: 'I click sugli annunci Google Ads nel mese.',
  gads_conversions: 'Le conversioni registrate da Google Ads nel mese (telefonate, moduli, azioni impostate come conversione).',
  gads_spend: 'La spesa delle campagne Google Ads nel mese, IVA esclusa.',
  cpl_google: 'Spesa Google Ads del mese divisa per i lead con provenienza «Google» dello Sheet.',
}

function HelpTip({ text, label }: { text: string; label: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`Cos'è «${label}»`} className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-3 text-xs leading-relaxed">
        <p className="mb-1 font-semibold text-foreground">{label}</p>
        <p className="text-muted-foreground">{text}</p>
      </PopoverContent>
    </Popover>
  )
}

/** Colori del funnel: lead → appuntamento → preventivo → vendita. */
const TYPE_TONE: Record<EntryType, { bar: string; dot: string; icon: LucideIcon }> = {
  lead: { bar: 'bg-sky-500', dot: 'bg-sky-500', icon: Inbox },
  appuntamento: { bar: 'bg-violet-500', dot: 'bg-violet-500', icon: CalendarCheck },
  preventivo: { bar: 'bg-amber-500', dot: 'bg-amber-500', icon: FileText },
  vendita: { bar: 'bg-emerald-500', dot: 'bg-emerald-500', icon: Car },
}

function DeltaBadge({ k }: { k: KpiResult }) {
  if (k.value === null) return <span className="text-[11px] text-muted-foreground">{k.missing ?? 'Nessun dato'}</span>
  if (!k.vsPrev) return <span className="text-[11px] text-muted-foreground">nessun confronto</span>
  const d = k.vsPrev
  const cls = d.tone === 'good' ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400' : d.tone === 'bad' ? 'bg-red-500/12 text-red-700 dark:text-red-400' : 'bg-muted text-muted-foreground'
  const Icon = d.value > 0 ? TrendingUp : d.value < 0 ? TrendingDown : null
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${cls}`} title="Rispetto al mese prima">
        {Icon && <Icon className="h-3 w-3" />}{formatDelta(d, k.unit)}
      </span>
      <span className="text-[11px] text-muted-foreground">vs mese prima{d.small ? ' · pochi dati' : ''}</span>
    </span>
  )
}

function KpiCard({ k, featured }: { k: KpiResult; featured?: boolean }) {
  const Icon = KPI_ICON[k.id] ?? Activity
  return (
    <div className={`group relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md ${featured ? 'ring-1 ring-primary/30' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-start gap-1 text-xs font-medium leading-tight text-muted-foreground"><span>{k.label}</span>{KPI_HELP[k.id] && <HelpTip text={KPI_HELP[k.id]} label={k.label} />}</p>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" /></span>
      </div>
      <p className={`font-bold tabular-nums tracking-tight text-foreground ${featured ? 'text-3xl' : 'text-2xl'}`}>{k.value === null ? '—' : formatValue(k.value, k.unit)}</p>
      <DeltaBadge k={k} />
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
        {KPI_SOURCE[k.id] ?? ''}{k.kind === 'proxy' ? ` · stima (${k.proxyOf})` : ''}
      </p>
    </div>
  )
}

/** Il percorso del mese: lead → appuntamenti → preventivi → vendite, con la resa di ogni passaggio. */
function FunnelStrip({ totals }: { totals: MonthTotals }) {
  const steps = ENTRY_TYPES.map((t, i) => ({
    type: t, value: totals.byType[t],
    rate: i === 0 ? null : funnelRate(totals.byType[t], totals.byType[ENTRY_TYPES[i - 1]]),
  }))
  const fromLead = funnelRate(totals.byType.vendita, totals.byType.lead)
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="grid grid-cols-2 divide-y divide-border md:grid-cols-4 md:divide-x md:divide-y-0">
        {steps.map((s) => {
          const { icon: Icon, dot } = TYPE_TONE[s.type]
          return (
            <div key={s.type} className="relative flex flex-col gap-1 px-5 py-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className={`h-2 w-2 rounded-full ${dot}`} /> {TYPE_LABEL[s.type]}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{int(s.value)}</span>
                {s.rate !== null && <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted-foreground"><ArrowRight className="h-3 w-3" />{pct(s.rate)}</span>}
              </div>
              <p className="text-[11px] text-muted-foreground">{s.type === 'lead' ? 'dichiarati nello Sheet' : `del passaggio precedente`}</p>
              <Icon className="absolute right-4 top-4 h-4 w-4 text-muted-foreground/40" />
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-5 py-2.5 text-xs text-muted-foreground">
        <span>Vendite su lead: <b className="text-foreground">{pct(fromLead)}</b></span>
        <span>Appuntamenti su lead: <b className="text-foreground">{pct(funnelRate(totals.byType.appuntamento, totals.byType.lead))}</b></span>
      </div>
    </div>
  )
}

/** Marca o provenienza: una riga per voce, barra proporzionale ai lead e i quattro numeri a destra. */
function BreakdownCard({ title, icon: Icon, rows, totals }: { title: string; icon: LucideIcon; rows: { key: string; byType: Record<EntryType, number> }[]; totals: MonthTotals }) {
  const max = Math.max(1, ...rows.map((r) => r.byType.lead))
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold tracking-tight">{title}</p>
          <p className="text-xs text-muted-foreground">{rows.length} {rows.length === 1 ? 'voce' : 'voci'} · barra = quota di lead</p>
        </div>
        <div className="hidden gap-3 text-[10px] uppercase tracking-wide text-muted-foreground sm:flex">
          {ENTRY_TYPES.map((t) => <span key={t} className="flex items-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${TYPE_TONE[t].dot}`} />{TYPE_LABEL[t]}</span>)}
        </div>
      </div>
      <ul className="divide-y divide-border/60">
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_repeat(4,3.25rem)]">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.key}</p>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={`h-full rounded-full ${TYPE_TONE.lead.bar}`} style={{ width: `${Math.round((r.byType.lead / max) * 100)}%` }} />
              </div>
            </div>
            <div className="col-span-1 flex gap-3 text-right text-sm tabular-nums sm:contents">
              {ENTRY_TYPES.map((t) => (
                <span key={t} className={`sm:text-right ${r.byType[t] ? 'font-semibold text-foreground' : 'text-muted-foreground/60'}`} title={TYPE_LABEL[t]}>
                  {r.byType[t] ? int(r.byType[t]) : '—'}
                </span>
              ))}
            </div>
          </li>
        ))}
        <li className="grid grid-cols-[1fr_auto] items-center gap-x-4 rounded-b-2xl bg-muted/40 px-4 py-2.5 text-xs font-semibold sm:grid-cols-[minmax(0,1fr)_repeat(4,3.25rem)]">
          <span>Totale</span>
          <div className="flex gap-3 text-right tabular-nums sm:contents">
            {ENTRY_TYPES.map((t) => <span key={t} className="sm:text-right">{int(totals.byType[t])}</span>)}
          </div>
        </li>
      </ul>
    </div>
  )
}

export default function DealerKpiPage() {
  const { id } = useParams() as { id: string }
  const { currentUser } = useLayoutData()
  const { authFetch } = useAuthFetch()
  const isAdmin = currentUser?.role === 'Amministratore'
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [url, setUrl] = useState('')
  const [tab, setTab] = useState('Dati')
  const [busy, setBusy] = useState<string | null>(null)
  const [kpiMonth, setKpiMonth] = useState<string>(() => defaultMonthKey())
  const [kpiData, setKpiData] = useState<KpiPayload | null>(null)
  const [kpiLoading, setKpiLoading] = useState(false)
  const [kpiError, setKpiError] = useState<string | null>(null)
  const [noProfile, setNoProfile] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`/api/clients/${id}/dealer-kpi`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      setData(json)
      if (json.config) setTab(json.config.tab)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore di caricamento')
    } finally { setLoading(false) }
  }, [authFetch, id])
  useEffect(() => { load() }, [load])

  // I KPI si leggono subito, in parallelo con lo Sheet: il mese di partenza è quello in corso e non dipende dai dati
  const loadKpis = useCallback(async (month: string, fresh = false) => {
    if (!isMonthKey(month)) return
    setKpiLoading(true); setKpiError(null); setNoProfile(false)
    try {
      const res = await authFetch(`/api/clients/${id}/dealer-kpi/kpis?month=${month}${fresh ? '&fresh=1' : ''}`)
      const json = await res.json()
      if (!res.ok) { setNoProfile(!!json?.noProfile); throw new Error(json?.error || `Il server ha risposto ${res.status}.`) }
      setKpiData(json)
    } catch (e) {
      setKpiData(null); setKpiError(e instanceof Error ? e.message : 'Errore')
    } finally { setKpiLoading(false) }
  }, [authFetch, id])
  useEffect(() => { loadKpis(kpiMonth) }, [kpiMonth, loadKpis])

  const save = async () => {
    setBusy('save')
    try {
      const res = await authFetch(`/api/clients/${id}/dealer-kpi`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetUrl: url, tab }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      toast.success(json.removed ? 'Sheet scollegato.' : 'Sheet collegato. Ora premi «Sincronizza ora».')
      setUrl('')
      await load()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Errore') } finally { setBusy(null) }
  }
  const sync = async () => {
    setBusy('sync')
    try {
      const res = await authFetch(`/api/clients/${id}/dealer-kpi/sync`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      const s = json.status as SyncStatus
      if (s.lastStatus === 'errore') toast.error(s.lastMessage); else toast.success(s.lastMessage)
      await load()
      loadKpis(kpiMonth, true)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Errore') } finally { setBusy(null) }
  }

  if (loading) return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carico il report…</div>
  if (!data) return <p className="p-6 text-sm text-muted-foreground">Non riesco a caricare i dati del cliente.</p>
  const st = data.config?.status ?? null
  // Lo Sheet dei lead, marca e provenienza è dei concessionari (e di chi ne ha già collegato uno): gli altri vedono solo i KPI
  const isDealer = data.kpiProfile === 'auto' || !!data.config
  const months = [...data.months].reverse()
  // Marca e provenienza del mese scelto: righe = marche (o provenienze) presenti, colonne = lead, appuntamenti, preventivi, vendite
  const selected = data.months.find((m) => m.month === kpiMonth) ?? null
  const breakdownRows = (maps: Record<EntryType, Record<string, number>> | undefined) => {
    const keys = new Set<string>()
    for (const t of ENTRY_TYPES) for (const k of Object.keys(maps?.[t] ?? {})) keys.add(k)
    return Array.from(keys)
      .map((key) => ({ key, byType: Object.fromEntries(ENTRY_TYPES.map((t) => [t, maps?.[t]?.[key] ?? 0])) as Record<EntryType, number> }))
      .sort((a, b) => b.byType.lead - a.byType.lead || a.key.localeCompare(b.key, 'it'))
  }

  const downloadCsv = () => {
    const kpis: ClientCsvKpi[] = []
    if (kpiData && kpiData.month === kpiMonth) {
      for (const g of kpiData.groups) {
        for (const kid of g.ids) {
          const k = kpiData.kpis.find((x) => x.id === kid)
          if (!k) continue
          kpis.push({
            group: g.label, label: k.label, value: k.value, unit: k.unit,
            delta: k.value !== null && k.vsPrev ? formatDelta(k.vsPrev, k.unit) : null,
            note: k.value === null ? (k.missing ?? 'Nessun dato') : k.kind === 'proxy' ? `stima (${k.proxyOf})` : null,
          })
        }
      }
    }
    const csv = clientToCsv({ name: data.clientName, months: data.months, month: kpiMonth, kpis })
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    const slug = data.clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cliente'
    a.href = url; a.download = `kpi-${slug}-${kpiMonth}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const sheetSummary = data.config
    ? <span className={`text-xs font-medium ${st ? STATUS_CLS[st.lastStatus] : 'text-muted-foreground'}`}>{st ? (st.lastStatus === 'ok' ? 'Sincronizzato' : st.lastStatus === 'avvisi' ? 'Con avvisi' : 'Errore') : 'Da sincronizzare'}</span>
    : <span className="text-xs font-medium text-muted-foreground">Non collegato</span>

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Testata: titolo, mese e azioni */}
      <header className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary"><BarChart3 className="h-3.5 w-3.5" /> {isDealer ? 'Report KPI concessionario' : 'Report KPI'}</p>
            <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight text-foreground">{data.clientName}</h1>
            <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
              {isDealer
                ? 'Sito, campagne, Google Maps, lead e vendite per marca e provenienza, costo per lead: tutto in una pagina, confrontato con il mese prima. Il CSV scarica lo stesso report.'
                : `I KPI di un cliente «${kpiData?.profileLabel ?? 'del suo profilo'}»: sito, campagne e canali collegati, con il confronto sul mese prima e sull'anno scorso.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <input type="month" value={kpiMonth} onChange={(e) => e.target.value && setKpiMonth(e.target.value)} className="bg-transparent text-sm font-medium text-foreground outline-none" aria-label="Mese del report" />
            </label>
            <button type="button" onClick={() => loadKpis(kpiMonth, true)} disabled={kpiLoading} className={btn} title={kpiData?.computedAt ? `Dati letti alle ${timeLabel(kpiData.computedAt)}: rileggi le piattaforme adesso` : 'Rileggi le piattaforme adesso'}>
              <RefreshCw className={`h-4 w-4 ${kpiLoading ? 'animate-spin' : ''}`} /> Aggiorna
            </button>
            {isDealer && (
              <button onClick={downloadCsv} disabled={data.months.length === 0 && !kpiData}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                title="Report KPI del mese scelto, marca e provenienza del mese e totali di tutti i mesi dello Sheet">
                <Download className="h-4 w-4" /> Scarica CSV
              </button>
            )}
          </div>
        </div>
        {kpiData?.partial && !kpiLoading && (
          <div className="flex items-center gap-2 border-t border-amber-500/30 bg-amber-500/10 px-5 py-2 text-xs text-amber-700 dark:text-amber-400 sm:px-6">
            <AlertTriangle className="h-3.5 w-3.5" /> Mese in corso: i numeri sono dei primi {kpiData.partial.days} giorni.
          </div>
        )}
      </header>

      {/* Sheet da correggere: sempre in vista */}
      {isDealer && st && st.issuesTotal > 0 && (
        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Da correggere nello Sheet ({st.issuesTotal})</h2>
          <ul className="mt-1.5 space-y-0.5 text-sm">
            {st.issues.map((i, k) => <li key={k}><span className={i.level === 'errore' ? 'font-medium text-red-600 dark:text-red-400' : 'font-medium text-amber-600 dark:text-amber-400'}>Riga {i.row}</span> · {i.message}</li>)}
          </ul>
          {st.issuesTotal > st.issues.length && <p className="mt-1 text-xs text-muted-foreground">… e altri {st.issuesTotal - st.issues.length}.</p>}
        </section>
      )}

      {/* Il percorso del mese */}
      {isDealer && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-extrabold tracking-tight">Il percorso di <span className="capitalize">{monthLabel(kpiMonth)}</span></h2>
            <p className="text-xs text-muted-foreground">dallo Sheet del cliente</p>
          </div>
          {selected ? <FunnelStrip totals={selected} /> : (
            <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nessuna riga nello Sheet per questo mese: quando il cliente lo compila (e dopo la sincronizzazione notturna o «Sincronizza ora») qui compaiono lead, appuntamenti, preventivi e vendite.
            </p>
          )}
        </section>
      )}

      {/* KPI dalle piattaforme */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-extrabold tracking-tight">KPI di <span className="capitalize">{monthLabel(kpiMonth)}</span></h2>
          <p className="text-xs text-muted-foreground">dalle piattaforme collegate in Setup API{kpiData?.computedAt && !kpiLoading ? ` · letti alle ${timeLabel(kpiData.computedAt)}` : ''}</p>
        </div>
        {kpiLoading && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-[118px] animate-pulse rounded-2xl border border-border bg-muted/40" />)}
            <p className="col-span-full flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Leggo le piattaforme collegate: può richiedere qualche secondo…</p>
          </div>
        )}
        {kpiError && noProfile && (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            {kpiError} <Link href="/admin/report-mensile" className="underline">Apri Mail mensile KPI</Link>.
          </p>
        )}
        {kpiError && !noProfile && <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-400">{kpiError}</p>}
        {kpiData && !kpiLoading && (
          <div className="space-y-5">
            {kpiData.groups.map((g, gi) => {
              const items = g.ids.map((kid) => kpiData.kpis.find((x) => x.id === kid)).filter((k): k is KpiResult => !!k)
              if (items.length === 0) return null
              const primary = gi === 0
              return (
                <div key={g.label} className="space-y-2">
                  {!primary && <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><span className="h-px w-4 bg-border" />{g.label}</h3>}
                  <div className={`grid grid-cols-2 gap-3 ${primary ? 'md:grid-cols-3 xl:grid-cols-4' : 'md:grid-cols-4 xl:grid-cols-5'}`}>
                    {items.map((k) => <KpiCard key={k.id} k={k} featured={primary && (k.id === 'leads_real' || k.id === 'cost_per_lead_total' || k.id === 'sales')} />)}
                  </div>
                </div>
              )
            })}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {isDealer ? 'Il costo per lead (Google + Meta) è la spesa dei due canali divisa per i lead di quei due canali dichiarati nello Sheet. Le impression del report sommano Meta Ads e Google Ads; la copertura è solo Meta (Google Ads non dà le persone raggiunte). ' : 'Impression e copertura sono di Meta Ads. '}
              Sessioni e utenti sono quelli di Analytics («utenti attivi»). Con più siti gli utenti non si sommano: la stessa persona conterebbe due volte.
            </p>
          </div>
        )}
      </section>

      {isDealer && (
        <>
          {/* Marca e provenienza */}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-extrabold tracking-tight">Marca e provenienza</h2>
              <p className="text-xs text-muted-foreground">chi compra cosa, e da dove arriva</p>
            </div>
            {!selected ? (
              <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nessuna riga nello Sheet per questo mese.</p>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                <BreakdownCard title="Per marca" icon={Car} rows={breakdownRows(selected.byBrand)} totals={selected} />
                <BreakdownCard title="Per provenienza" icon={Megaphone} rows={breakdownRows(selected.bySource)} totals={selected} />
              </div>
            )}
          </section>

          {/* Storico */}
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-extrabold tracking-tight">Mese per mese</h2>
              <p className="text-xs text-muted-foreground">tutti i mesi compilati nello Sheet</p>
            </div>
            {months.length === 0 ? <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nessun dato: collega lo Sheet e sincronizza. Un mese non compilato non compare (non è zero).</p> : (
              <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-semibold">Mese</th>
                      {ENTRY_TYPES.map((t) => <th key={t} className="px-3 py-2.5 text-right font-semibold"><span className="inline-flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${TYPE_TONE[t].dot}`} />{TYPE_LABEL[t]}</span></th>)}
                      <th className="px-3 py-2.5 text-right font-semibold">App. / lead</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Vendite / lead</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => {
                      const active = m.month === kpiMonth
                      return (
                        <tr key={m.month} onClick={() => setKpiMonth(m.month)} className={`cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-accent/50 ${active ? 'bg-primary/5' : ''}`} title="Mostra questo mese">
                          <td className="px-4 py-2.5 font-medium capitalize">{active && <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />}{monthLabel(m.month)}</td>
                          {ENTRY_TYPES.map((t) => <td key={t} className="px-3 py-2.5 text-right tabular-nums">{int(m.byType[t])}</td>)}
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{pct(funnelRate(m.byType.appuntamento, m.byType.lead))}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums"><span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">{pct(funnelRate(m.byType.vendita, m.byType.lead))}</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Collegamento e istruzioni: in fondo, chiusi */}
          <CollapsibleCard
            icon={SheetIcon}
            title="Sheet del cliente"
            description={data.config ? `Scheda «${data.config.tab}»${st ? ` · ultima lettura ${fmt(st.lastSyncAt)}` : ''}` : 'Il foglio Google con lead, appuntamenti, preventivi e vendite'}
            summary={sheetSummary}
            actions={data.config && isAdmin ? (
              <button className={btn} disabled={busy !== null} onClick={sync}>{busy === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sincronizza ora</button>
            ) : undefined}
          >
            <div className="space-y-4 text-sm">
              {data.config ? (
                <div className="space-y-1">
                  <p><a className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline" href={`https://docs.google.com/spreadsheets/d/${data.config.spreadsheetId}`} target="_blank" rel="noopener noreferrer">Apri lo Sheet <ExternalLink className="h-3.5 w-3.5" /></a></p>
                  {st ? <p className="text-muted-foreground">Ultima sincronizzazione ({fmt(st.lastSyncAt)}): <span className={STATUS_CLS[st.lastStatus]}>{st.lastMessage}</span></p> : <p className="text-muted-foreground">Non ancora sincronizzato.</p>}
                </div>
              ) : <p className="text-muted-foreground">Nessuno Sheet collegato.</p>}

              {isAdmin && (
                <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input className="h-8 min-w-[260px] flex-1 rounded-lg border border-border bg-background px-2 text-sm" placeholder="Incolla il collegamento dello Sheet (https://docs.google.com/spreadsheets/d/…)" value={url} onChange={(e) => setUrl(e.target.value)} />
                    <input className="h-8 w-32 rounded-lg border border-border bg-background px-2 text-sm" value={tab} onChange={(e) => setTab(e.target.value)} aria-label="Nome della scheda" />
                    <button className={btn} disabled={busy !== null} onClick={save}>{busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />} {url.trim() ? 'Collega' : data.config ? 'Scollega' : 'Collega'}</button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Condividi lo Sheet, <b>in sola lettura</b>, con <code className="rounded bg-muted px-1">{data.serviceAccountEmail ?? 'l\'account di servizio Google (non configurato)'}</code>. Per scollegare lascia vuoto il campo e premi «Scollega». Lo Sheet si rilegge da solo ogni notte.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Table2 className="h-3.5 w-3.5" /> Come preparare lo Sheet</h3>
                <p className="text-muted-foreground">Scheda «{data.config?.tab ?? 'Dati'}», prima riga con queste colonne, una riga per ogni combinazione mese · tipo · marca · provenienza:</p>
                <ul className="grid gap-1 text-muted-foreground sm:grid-cols-2">
                  <li><b className="text-foreground">Mese</b>: per esempio 2026-11 oppure 11/2026</li>
                  <li><b className="text-foreground">Tipo</b>: {ENTRY_TYPES.map((t) => TYPE_LABEL[t]).join(', ')} (tendina)</li>
                  <li><b className="text-foreground">Marca</b>: la marca del veicolo</li>
                  <li><b className="text-foreground">Provenienza</b>: {SOURCES.join(', ')} (tendina)</li>
                  <li><b className="text-foreground">Quantità</b>: numero intero</li>
                </ul>
              </div>
            </div>
          </CollapsibleCard>
        </>
      )}
    </div>
  )
}
