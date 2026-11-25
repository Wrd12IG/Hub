"use client"

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { btn } from '@/app/(app)/outreach/shared'
import { funnelRate } from '@/lib/dealer-kpi/totals'
import { clientToCsv, type ClientCsvKpi } from '@/lib/dealer-kpi/overview'
import { formatDelta, formatValue, type KpiResult } from '@/lib/kpi-compute'
import { previousMonthKey, isMonthKey } from '@/lib/manual-kpis'
import { ENTRY_TYPES, SOURCES, TYPE_LABEL, type MonthTotals } from '@/lib/dealer-kpi/types'
import type { SyncStatus } from '@/lib/dealer-kpi/sync'

type KpiPayload = { month: string; profile?: string; profileLabel?: string; groups: { label: string; ids: string[] }[]; kpis: KpiResult[]; alerts: string[]; partial: { days: number } | null }

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
  const [kpiMonth, setKpiMonth] = useState<string>(previousMonthKey())
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

  // Di partenza il mese più recente con dati nello Sheet (se c'è), altrimenti il mese scorso
  const defaultedMonth = React.useRef(false)
  useEffect(() => {
    if (defaultedMonth.current || !data) return
    defaultedMonth.current = true
    const latest = data.months.length ? data.months[data.months.length - 1].month : null
    if (latest && isMonthKey(latest)) setKpiMonth(latest)
  }, [data])

  const loadKpis = useCallback(async (month: string) => {
    if (!isMonthKey(month)) return
    setKpiLoading(true); setKpiError(null); setNoProfile(false)
    try {
      const res = await authFetch(`/api/clients/${id}/dealer-kpi/kpis?month=${month}`)
      const json = await res.json()
      if (!res.ok) { setNoProfile(!!json?.noProfile); throw new Error(json?.error || `Il server ha risposto ${res.status}.`) }
      setKpiData(json)
    } catch (e) {
      setKpiData(null); setKpiError(e instanceof Error ? e.message : 'Errore')
    } finally { setKpiLoading(false) }
  }, [authFetch, id])
  useEffect(() => { if (data) loadKpis(kpiMonth) }, [data === null, kpiMonth, loadKpis]) // eslint-disable-line react-hooks/exhaustive-deps

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
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Errore') } finally { setBusy(null) }
  }

  if (loading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
  if (!data) return <p className="p-6 text-sm text-muted-foreground">Non riesco a caricare i dati del cliente.</p>
  const st = data.config?.status ?? null
  // Lo Sheet dei lead, marca e provenienza è dei concessionari (e di chi ne ha già collegato uno): gli altri vedono solo i KPI
  const isDealer = data.kpiProfile === 'auto' || !!data.config
  const months = [...data.months].reverse()

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

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{data.kpiProfile === 'auto' ? 'KPI concessionario' : 'KPI'} · {data.clientName}</h1>
          <p className="text-sm text-muted-foreground">
            {isDealer
              ? 'Lead, appuntamenti, preventivi e vendite per marca e provenienza, letti dallo Sheet Google condiviso con il cliente, più i KPI delle piattaforme.'
              : `I KPI di un cliente «${kpiData?.profileLabel ?? 'del suo profilo'}»: sito, campagne e canali collegati, con il confronto sul mese prima e sull'anno scorso.`}
          </p>
        </div>
        {isDealer && (
          <button onClick={downloadCsv} disabled={data.months.length === 0} className={btn} title="Totali di tutti i mesi, marca e provenienza del mese scelto e, se già caricati, i KPI di piattaforma">
            <Download className="h-4 w-4" /> Scarica CSV
          </button>
        )}
      </header>

      {isDealer && (
        <>
      <section className="space-y-3 rounded-xl border border-border p-4">
        <h2 className="text-sm font-medium">Sheet del cliente</h2>
        {data.config ? (
          <div className="space-y-1 text-sm">
            <p>Collegato: <a className="underline" href={`https://docs.google.com/spreadsheets/d/${data.config.spreadsheetId}`} target="_blank" rel="noopener noreferrer">apri lo Sheet</a> · scheda «{data.config.tab}»</p>
            {st ? (
              <p>Ultima sincronizzazione ({fmt(st.lastSyncAt)}): <span className={STATUS_CLS[st.lastStatus]}>{st.lastMessage}</span></p>
            ) : <p className="text-muted-foreground">Non ancora sincronizzato.</p>}
          </div>
        ) : <p className="text-sm text-muted-foreground">Nessuno Sheet collegato.</p>}

        {isAdmin && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input className="h-8 min-w-[260px] flex-1 rounded-lg border border-border bg-background px-2 text-sm" placeholder="Incolla il collegamento dello Sheet (https://docs.google.com/spreadsheets/d/…)" value={url} onChange={(e) => setUrl(e.target.value)} />
              <input className="h-8 w-32 rounded-lg border border-border bg-background px-2 text-sm" value={tab} onChange={(e) => setTab(e.target.value)} aria-label="Nome della scheda" />
              <button className={btn} disabled={busy !== null} onClick={save}>{busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />} {url.trim() ? 'Collega' : data.config ? 'Scollega' : 'Collega'}</button>
              {data.config && <button className={btn} disabled={busy !== null} onClick={sync}>{busy === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sincronizza ora</button>}
            </div>
            <p className="text-xs text-muted-foreground">
              Condividi lo Sheet, <b>in sola lettura</b>, con <code className="rounded bg-muted px-1">{data.serviceAccountEmail ?? 'l\'account di servizio Google (non configurato)'}</code>. Per scollegare lascia vuoto il campo e premi «Scollega». Lo Sheet si rilegge da solo ogni notte.
            </p>
          </div>
        )}
      </section>

      {st && st.issuesTotal > 0 && (
        <section className="space-y-1 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <h2 className="text-sm font-medium">Da correggere nello Sheet ({st.issuesTotal})</h2>
          <ul className="space-y-0.5 text-sm">
            {st.issues.map((i, k) => <li key={k}><span className={i.level === 'errore' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}>Riga {i.row}</span> · {i.message}</li>)}
          </ul>
          {st.issuesTotal > st.issues.length && <p className="text-xs text-muted-foreground">… e altri {st.issuesTotal - st.issues.length}.</p>}
        </section>
      )}

        </>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-medium">KPI del mese</h2>
          <label className="text-xs text-muted-foreground">Mese
            <input type="month" value={kpiMonth} onChange={(e) => e.target.value && setKpiMonth(e.target.value)} className="ml-2 h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground" />
          </label>
        </div>
        {kpiLoading && <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Leggo le piattaforme collegate: può richiedere qualche secondo…</p>}
        {kpiError && noProfile && (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            {kpiError} <Link href="/admin/report-mensile" className="underline">Apri Mail mensile KPI</Link>.
          </p>
        )}
        {kpiError && !noProfile && <p className="text-sm text-red-600 dark:text-red-400">{kpiError}</p>}
        {kpiData && !kpiLoading && (
          <div className="space-y-4">
            {kpiData.partial && <p className="text-xs text-amber-600 dark:text-amber-400">Mese in corso: i numeri sono dei primi {kpiData.partial.days} giorni.</p>}
            {kpiData.groups.map((g) => (
              <div key={g.label} className="space-y-1.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</h3>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  {g.ids.map((kid) => {
                    const k = kpiData.kpis.find((x) => x.id === kid)
                    if (!k) return null
                    const tone = k.vsPrev?.tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : k.vsPrev?.tone === 'bad' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                    return (
                      <div key={kid} className="rounded-xl border border-border p-3">
                        <p className="text-xs text-muted-foreground">{k.label}</p>
                        <p className="mt-1 text-xl font-semibold [font-variant-numeric:tabular-nums]">{k.value === null ? '—' : formatValue(k.value, k.unit)}</p>
                        {k.value === null
                          ? <p className="text-[11px] text-muted-foreground">{k.missing ?? 'Nessun dato'}</p>
                          : <p className={`text-[11px] ${tone}`}>{k.vsPrev ? `${formatDelta(k.vsPrev, k.unit)} sul mese prima` : 'nessun confronto'}{k.kind === 'proxy' ? ` · stima (${k.proxyOf})` : ''}</p>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              {isDealer ? 'Il costo per lead è la spesa di Google e Meta divisa per i lead di quei due canali dichiarati nello Sheet. ' : ''}
              Impression e copertura sono di Meta Ads; il numero di utenti è quello di Analytics («utenti attivi»). Con più siti gli utenti non si sommano: la stessa persona conterebbe due volte.
            </p>
          </div>
        )}
      </section>

      {isDealer && (
        <>
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Totali per mese</h2>
        {months.length === 0 ? <p className="text-sm text-muted-foreground">Nessun dato: collega lo Sheet e sincronizza. Un mese non compilato non compare (non è zero).</p> : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-2">Mese</th>
                {ENTRY_TYPES.map((t) => <th key={t} className="p-2 text-right">{TYPE_LABEL[t]}</th>)}
                <th className="p-2 text-right">Appuntamenti / lead</th><th className="p-2 text-right">Vendite / lead</th>
              </tr></thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} className="border-b border-border/50 last:border-0">
                    <td className="p-2 font-medium capitalize">{monthLabel(m.month)}</td>
                    {ENTRY_TYPES.map((t) => <td key={t} className="p-2 text-right">{m.byType[t].toLocaleString('it-IT')}</td>)}
                    <td className="p-2 text-right">{pct(funnelRate(m.byType.appuntamento, m.byType.lead))}</td>
                    <td className="p-2 text-right">{pct(funnelRate(m.byType.vendita, m.byType.lead))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-1 rounded-xl border border-border p-4 text-sm">
        <h2 className="text-sm font-medium">Come preparare lo Sheet</h2>
        <p className="text-muted-foreground">Scheda «Dati», prima riga con queste colonne, una riga per ogni combinazione:</p>
        <ul className="list-inside list-disc text-muted-foreground">
          <li><b>Mese</b>: per esempio 2026-11 oppure 11/2026</li>
          <li><b>Tipo</b>: {ENTRY_TYPES.map((t) => TYPE_LABEL[t]).join(', ')} (tendina)</li>
          <li><b>Marca</b>: la marca del veicolo</li>
          <li><b>Provenienza</b>: {SOURCES.join(', ')} (tendina)</li>
          <li><b>Quantità</b>: numero intero</li>
        </ul>
      </section>
        </>
      )}
    </div>
  )
}
