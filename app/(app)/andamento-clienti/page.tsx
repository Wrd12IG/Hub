"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, HelpCircle, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { ReportSectionNav } from '@/components/report-section-nav'
import { isMonthKey, previousMonthKey } from '@/lib/manual-kpis'
import { KPI_CATALOG, KPI_PROFILES, PROFILE_DEFS, isKpiProfile, type KpiProfile } from '@/lib/kpi-profiles'
import type { WeekResult } from '@/lib/kpi-weekly'
import { formatDelta, formatValue, monthLabel, type ClientMonthly, type Delta, type VerdictState } from '@/lib/kpi-compute'

type Snap = { computedAt: string; result: ClientMonthly }
type Included = { id: string; name: string; profile?: KpiProfile }
type Filter = 'all' | VerdictState
/** Chi si vede e si aggiorna: tutti, uno o più settori (profili KPI), oppure clienti a scelta libera. */
type ScopeMode = 'all' | 'sector' | 'free'
const SCOPE_KEY = 'andamento-clienti:scope'

const CONCURRENCY = 2
const btn = 'inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'

const STATE: Record<VerdictState, { label: string; text: string; ring: string; bg: string; icon: React.ElementType; order: number }> = {
  down: { label: 'In calo', text: 'text-red-600 dark:text-red-400', ring: 'border-red-500/40', bg: 'bg-red-500/10', icon: ArrowDownRight, order: 0 },
  flat: { label: 'Stabile', text: 'text-amber-600 dark:text-amber-400', ring: 'border-amber-500/40', bg: 'bg-amber-500/10', icon: ArrowRight, order: 2 },
  up: { label: 'In crescita', text: 'text-emerald-600 dark:text-emerald-400', ring: 'border-emerald-500/40', bg: 'bg-emerald-500/10', icon: ArrowUpRight, order: 3 },
  unknown: { label: 'Dati insufficienti', text: 'text-muted-foreground', ring: 'border-border', bg: 'bg-muted/40', icon: HelpCircle, order: 4 },
}
const TONE: Record<Delta['tone'], string> = { good: 'text-emerald-600 dark:text-emerald-400', bad: 'text-red-600 dark:text-red-400', neutral: 'text-muted-foreground' }

function DeltaText({ d, unit }: { d: Delta | null; unit: ClientMonthly['kpis'][number]['unit'] }) {
  if (!d) return <span className="text-muted-foreground">—</span>
  return <span className={TONE[d.tone]}>{formatDelta(d, unit)}</span>
}


const WEEK_MARK: Record<VerdictState, { sym: string; cls: string; label: string }> = {
  up: { sym: '▲', cls: 'text-emerald-600 dark:text-emerald-400', label: 'meglio' },
  down: { sym: '▼', cls: 'text-red-600 dark:text-red-400', label: 'peggio' },
  flat: { sym: '=', cls: 'text-amber-600 dark:text-amber-400', label: 'stabile' },
  unknown: { sym: '·', cls: 'text-muted-foreground', label: 'dati insufficienti' },
}
const days = (w: WeekResult) => `${Number(w.dateFrom.slice(8, 10))}–${Number(w.dateTo.slice(8, 10))}`

/** Settimana su settimana: ogni settimana (blocchi di 7 giorni dal 1°) contro la stessa del mese prima. */
function WeeksTable({ weeks }: { weeks: WeekResult[] }) {
  const ids = (weeks.find((w) => w.kpis.length)?.kpis ?? []).map((k) => k.id)
  if (ids.length === 0) return null
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="py-1 pr-2 text-left font-medium">KPI</th>
            {weeks.map((w) => (
              <th key={w.n} className="px-2 py-1 text-right font-medium" title={w.comparable ? 'Confrontata con la stessa settimana del mese scorso' : 'Nessuna settimana uguale nel mese scorso'}>
                {days(w)} <span className={WEEK_MARK[w.verdict].cls} title={WEEK_MARK[w.verdict].label}>{WEEK_MARK[w.verdict].sym}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const def = KPI_CATALOG[id]
            return (
              <tr key={id} className="border-t border-border/50">
                <td className="py-1.5 pr-2">{def.label}</td>
                {weeks.map((w) => {
                  const k = w.kpis.find((x) => x.id === id)
                  if (w.unavailable || !k) return <td key={w.n} className="px-2 py-1.5 text-right text-muted-foreground">n/d</td>
                  return (
                    <td key={w.n} className="whitespace-nowrap px-2 py-1.5 text-right align-top">
                      <div className="font-semibold">{k.value === null ? <span className="font-normal text-muted-foreground">—</span> : formatValue(k.value, def.unit)}{k.kind === 'proxy' && <sup className="text-amber-600" title="Stima da Meta">*</sup>}</div>
                      {k.vsPrev && <div className="text-[11px]"><DeltaText d={k.vsPrev} unit={def.unit} /></div>}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Peso per l'ordinamento: prima chi è in calo, poi chi ha segnali da guardare, poi gli altri. */
const rank = (r: ClientMonthly) => (r.verdict.state === 'down' ? 0 : r.alerts.length > 0 && r.verdict.state !== 'unknown' ? 1 : STATE[r.verdict.state].order)

/**
 * Andamento clienti: per ogni cliente nella mail mensile, i KPI scelti per il suo profilo con il confronto sul mese scorso
 * e sull'anno scorso, e il verdetto (in crescita / stabile / in calo). I numeri sono le stesse «fotografie» della mail
 * mensile (lib/kpi-compute.ts): qui non si ricalcola niente di diverso, si leggono. Solo amministratori.
 */
export default function AndamentoClientiPage() {
  const { authFetch } = useAuthFetch()
  const { currentUser } = useLayoutData()
  const [month, setMonth] = useState(previousMonthKey())
  const [included, setIncluded] = useState<Included[]>([])
  const [snaps, setSnaps] = useState<Record<string, Snap>>({})
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<Filter>('all')
  const [mode, setMode] = useState<ScopeMode>('all')
  const [sectors, setSectors] = useState<KpiProfile[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string[]>([])
  const stop = useRef(false)

  // Si ricorda l'ultima scelta (solo comodità del browser: se non c'è, parte da «Tutti»)
  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(SCOPE_KEY) || 'null')
      if (raw && (raw.mode === 'sector' || raw.mode === 'free')) {
        setMode(raw.mode)
        setSectors(Array.isArray(raw.sectors) ? raw.sectors.filter(isKpiProfile) : [])
        setPicked(Array.isArray(raw.picked) ? raw.picked.filter((x: unknown) => typeof x === 'string') : [])
      }
    } catch { /* storage non disponibile: nessun problema */ }
  }, [])
  useEffect(() => {
    try { window.localStorage.setItem(SCOPE_KEY, JSON.stringify({ mode, sectors, picked })) } catch { /* idem */ }
  }, [mode, sectors, picked])

  const load = useCallback(async () => {
    if (!isMonthKey(month)) return
    setLoading(true)
    try {
      const res = await authFetch(`/api/admin/monthly-kpi-mail/snapshots?month=${month}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `Errore ${res.status}`)
      setIncluded(j.included ?? []); setSnaps(j.snapshots ?? {}); setErrors({})
    } catch (e: any) { toast.error(e.message || 'Impossibile leggere') }
    finally { setLoading(false) }
  }, [authFetch, month])

  useEffect(() => { if (currentUser?.role === 'Amministratore') load() }, [load, currentUser?.role])

  async function computeOne(c: Included): Promise<void> {
    try {
      const res = await authFetch('/api/admin/monthly-kpi-mail/client', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: c.id, month }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `Errore ${res.status}`)
      setSnaps((s) => ({ ...s, [c.id]: { computedAt: new Date().toISOString(), result: j.result } }))
      setErrors((e) => { const n = { ...e }; delete n[c.id]; return n })
    } catch (e: any) { setErrors((x) => ({ ...x, [c.id]: e.message || 'Errore' })) }
  }

  async function run(list: Included[]) {
    if (list.length === 0) return
    stop.current = false; setRunning(true); setProgress({ done: 0, total: list.length })
    let next = 0, done = 0
    const worker = async () => {
      while (!stop.current) {
        const c = list[next++]
        if (!c) return
        await computeOne(c)
        setProgress({ done: ++done, total: list.length })
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    setRunning(false)
  }

  /** Aggiorna un solo cliente (il pulsante sulla sua scheda). */
  async function refreshOne(c: Included) {
    setBusy((b) => [...b, c.id])
    await computeOne(c)
    setBusy((b) => b.filter((x) => x !== c.id))
  }

  // I clienti nel campo scelto: tutto ciò che si vede e si aggiorna (contatori, elenco, pulsanti) riguarda solo loro
  const scoped = useMemo(() => {
    if (mode === 'sector') return included.filter((c) => c.profile && sectors.includes(c.profile))
    if (mode === 'free') return included.filter((c) => picked.includes(c.id))
    return included
  }, [included, mode, sectors, picked])
  const sectorCounts = useMemo(() => {
    const m: Partial<Record<KpiProfile, number>> = {}
    for (const c of included) if (c.profile) m[c.profile] = (m[c.profile] ?? 0) + 1
    return m
  }, [included])
  const pickList = useMemo(() => {
    const q = search.trim().toLowerCase()
    return included.filter((c) => !q || c.name.toLowerCase().includes(q))
  }, [included, search])

  // Una fotografia calcolata prima delle settimane (senza `weeks`) conta come da aggiornare
  const missing = useMemo(() => scoped.filter((c) => !snaps[c.id]?.result.weeks), [scoped, snaps])
  const results = useMemo(
    () => scoped.map((c) => snaps[c.id]?.result).filter((r): r is ClientMonthly => !!r)
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'it', { sensitivity: 'base' })),
    [scoped, snaps],
  )
  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const counts = useMemo(() => {
    const c: Record<VerdictState, number> = { down: 0, flat: 0, up: 0, unknown: 0 }
    for (const r of results) c[r.verdict.state]++
    return c
  }, [results])
  const withAlerts = results.filter((r) => r.alerts.length > 0).length
  const shown = filter === 'all' ? results : results.filter((r) => r.verdict.state === filter)

  if (!currentUser) return null
  if (currentUser.role !== 'Amministratore') return <p className="p-6 text-sm text-muted-foreground">Pagina riservata agli amministratori.</p>

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
      <ReportSectionNav />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Andamento clienti</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Come sta andando ogni cliente rispetto ai KPI scelti per il suo profilo, nel mese di <b>{isMonthKey(month) ? monthLabel(month) : '—'}</b>.
          Il verdetto guarda il KPI principale contro il mese scorso; sotto i 10 eventi si dice «dati insufficienti» invece di inventare una percentuale.
          Ogni cliente ha anche il confronto settimana su settimana, così un calo si vede a metà mese: scegli il mese in corso per le settimane già chiuse.
          Per cambiare i KPI o chi compare qui: <Link href="/admin/report-mensile" className="underline">Mail mensile KPI</Link>.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-muted-foreground">Mese
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} disabled={running}
            className="mt-1 block h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground" />
        </label>
        <button type="button" className={btn} disabled={running || loading || missing.length === 0} onClick={() => run(missing)}>
          {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Calcola i mancanti ({missing.length})
        </button>
        <button type="button" className={btn} disabled={running || loading || scoped.length === 0}
          onClick={() => { if (window.confirm(`Ricalcolo ${scoped.length === 1 ? 'il cliente' : `i ${scoped.length} clienti`}? ${scoped.length > 1 ? 'Richiede alcuni minuti.' : ''}`)) run(scoped) }}>
          {mode === 'all' ? 'Ricalcola tutti' : `Ricalcola i selezionati (${scoped.length})`}
        </button>
        {running && <button type="button" className={btn} onClick={() => { stop.current = true }}>Ferma</button>}
      </div>

      {!loading && included.length > 0 && (
        <div className="space-y-2 rounded-xl border border-border bg-card/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Clienti:</span>
            {([['all', `Tutti (${included.length})`], ['sector', 'Per settore'], ['free', 'Scelta libera']] as [ScopeMode, string][]).map(([m, label]) => (
              <button key={m} type="button" disabled={running} onClick={() => setMode(m)}
                className={`h-8 rounded-full border px-3 text-xs font-medium disabled:opacity-50 ${mode === m ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-accent'}`}>
                {label}
              </button>
            ))}
            {mode !== 'all' && <span className="text-xs text-muted-foreground">→ {scoped.length} {scoped.length === 1 ? 'cliente' : 'clienti'}</span>}
          </div>

          {mode === 'sector' && (
            <div className="flex flex-wrap gap-2">
              {KPI_PROFILES.filter((p) => sectorCounts[p]).map((p) => (
                <button key={p} type="button" disabled={running} onClick={() => setSectors((l) => toggle(l, p))} title={PROFILE_DEFS[p].description}
                  className={`h-8 rounded-lg border px-3 text-xs font-medium disabled:opacity-50 ${sectors.includes(p) ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary' : 'border-border bg-background hover:bg-accent'}`}>
                  {PROFILE_DEFS[p].label} ({sectorCounts[p]})
                </button>
              ))}
              {sectors.length === 0 && <span className="self-center text-xs text-muted-foreground">Scegli uno o più settori.</span>}
            </div>
          )}

          {mode === 'free' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca un cliente…"
                  className="h-8 w-56 rounded-lg border border-border bg-background px-2 text-xs" />
                <button type="button" disabled={running} className="text-xs underline disabled:opacity-50" onClick={() => setPicked((p) => Array.from(new Set([...p, ...pickList.map((c) => c.id)])))}>Seleziona i {pickList.length} visibili</button>
                <button type="button" disabled={running || picked.length === 0} className="text-xs underline disabled:opacity-50" onClick={() => setPicked([])}>Deseleziona tutti</button>
                <span className="text-xs text-muted-foreground">{picked.length} selezionati</span>
              </div>
              <div className="grid max-h-56 grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto rounded-lg border border-border bg-background p-2 sm:grid-cols-2 md:grid-cols-3">
                {pickList.map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 text-xs">
                    <input type="checkbox" disabled={running} checked={picked.includes(c.id)} onChange={() => setPicked((p) => toggle(p, c.id))} />
                    <span className="truncate">{c.name}</span>
                  </label>
                ))}
                {pickList.length === 0 && <span className="text-xs text-muted-foreground">Nessun cliente trovato.</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {running && <p className="text-sm">Calcolo… <b>{progress.done}</b> di {progress.total}. Lascia aperta la pagina.</p>}
      {Object.keys(errors).length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <p className="font-semibold">Non calcolati ({Object.keys(errors).length}) — premi «Calcola i mancanti» per riprovare:</p>
          <ul className="mt-1 list-disc pl-5">{included.filter((c) => errors[c.id]).map((c) => <li key={c.id}>{c.name}: {errors[c.id]}</li>)}</ul>
        </div>
      )}

      {loading ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Carico…</p>
        : included.length === 0 ? <p className="text-sm text-muted-foreground">Nessun cliente da mostrare: in «Mail mensile KPI» accendi «Nella mail» e assegna un profilo ai clienti.</p>
        : scoped.length === 0 ? <p className="text-sm text-muted-foreground">{mode === 'sector' ? 'Scegli uno o più settori.' : 'Scegli uno o più clienti.'}</p>
        : results.length === 0 ? <p className="text-sm text-muted-foreground">Nessun cliente ancora calcolato per questo mese: premi «Calcola i mancanti».</p>
        : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(['down', 'flat', 'up', 'unknown'] as VerdictState[]).map((s) => {
                const st = STATE[s]; const Icon = st.icon
                return (
                  <button key={s} type="button" onClick={() => setFilter(filter === s ? 'all' : s)}
                    className={`rounded-xl border p-3 text-left transition ${st.ring} ${st.bg} ${filter === s ? 'ring-2 ring-primary' : ''}`}>
                    <span className={`flex items-center gap-1 text-xs font-medium ${st.text}`}><Icon size={14} /> {st.label}</span>
                    <span className="mt-1 block text-2xl font-bold">{counts[s]}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {results.length} clienti calcolati su {scoped.length}{mode !== 'all' && ' selezionati'}
              {withAlerts > 0 && <> · <AlertTriangle size={11} className="mb-0.5 inline text-amber-500" /> {withAlerts} con segnali da guardare</>}
              {filter !== 'all' && <> · filtro: {STATE[filter].label} (<button type="button" className="underline" onClick={() => setFilter('all')}>mostra tutti</button>)</>}
            </p>

            <div className="space-y-3">
              {shown.map((r) => {
                const st = STATE[r.verdict.state]; const Icon = st.icon
                return (
                  <section key={r.clientId} className={`rounded-xl border bg-card p-4 ${st.ring}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link href={`/clients/${encodeURIComponent(r.clientId)}`} className="text-base font-semibold hover:underline">{r.name}</Link>
                        <span className="ml-2 text-xs text-muted-foreground">{PROFILE_DEFS[r.profile]?.label ?? r.profile}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" title="Aggiorna solo questo cliente" disabled={running || busy.includes(r.clientId)}
                          onClick={() => { const c = included.find((x) => x.id === r.clientId); if (c) refreshOne(c) }}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
                          <RefreshCw size={12} className={busy.includes(r.clientId) ? 'animate-spin' : ''} /> Aggiorna
                        </button>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.bg} ${st.text}`}><Icon size={13} /> {st.label}</span>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{r.verdict.headline}</p>

                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-muted-foreground">
                            <th className="py-1 pr-2 text-left font-medium">KPI</th>
                            <th className="px-2 py-1 text-right font-medium">Mese</th>
                            <th className="px-2 py-1 text-right font-medium">vs mese scorso</th>
                            <th className="py-1 pl-2 text-right font-medium">vs anno scorso</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.kpis.map((k) => (
                            <tr key={k.id} className="border-t border-border/50">
                              <td className="py-1.5 pr-2">{k.label}</td>
                              <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">
                                {k.value === null ? <span className="font-normal text-muted-foreground">{k.missing ?? '—'}</span> : formatValue(k.value, k.unit)}
                                {k.kind === 'proxy' && <sup className="text-amber-600" title={`Stima: ${k.proxyOf}`}>*</sup>}
                              </td>
                              <td className="whitespace-nowrap px-2 py-1.5 text-right"><DeltaText d={k.vsPrev} unit={k.unit} /></td>
                              <td className="whitespace-nowrap py-1.5 pl-2 text-right"><DeltaText d={k.vsYoy} unit={k.unit} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {r.kpis.some((k) => k.kind === 'proxy') && <p className="mt-1 text-[11px] text-amber-600">* stima di piattaforma: il dato reale del mese non è stato inserito.</p>}
                    {r.partial && <p className="mt-1 text-[11px] text-muted-foreground">Mese in corso: numeri dei primi {r.partial.days} giorni, confrontati con gli stessi giorni del mese scorso e dell&apos;anno scorso.</p>}

                    {r.weeks && r.weeks.length > 0 && (
                      <details className="mt-3" open={r.verdict.state === 'down'}>
                        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
                          Settimana su settimana{' '}
                          {r.weeks.map((w) => <span key={w.n} className={`mr-1 ${WEEK_MARK[w.verdict].cls}`} title={`${days(w)}: ${WEEK_MARK[w.verdict].label}`}>{WEEK_MARK[w.verdict].sym}</span>)}
                        </summary>
                        <div className="mt-2"><WeeksTable weeks={r.weeks} /></div>
                        <p className="mt-1 text-[11px] text-muted-foreground">Settimane = blocchi di 7 giorni dal 1° (la 5ª è più corta), contro la stessa del mese scorso. I dati inseriti a mano sono solo mensili.</p>
                      </details>
                    )}

                    {r.alerts.length > 0 && (
                      <ul className="mt-3 space-y-1 text-xs">
                        {r.alerts.map((a, i) => <li key={i} className="flex gap-1.5"><AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" /> {a}</li>)}
                      </ul>
                    )}
                  </section>
                )
              })}
            </div>
          </>
        )}
    </div>
  )
}
