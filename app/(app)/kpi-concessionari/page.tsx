"use client"

import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Loader2 } from 'lucide-react'
import { ReportSectionNav } from '@/components/report-section-nav'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { monthLabel } from '@/lib/kpi-compute'
import { overviewToCsv, type Breakdown, type Overview } from '@/lib/dealer-kpi/overview'
import { ENTRY_TYPES, TYPE_LABEL, type EntryType } from '@/lib/dealer-kpi/types'

const fmt = (n: number) => n.toLocaleString('it-IT')
const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`)

function Funnel({ o }: { o: Overview }) {
  const max = Math.max(1, ...ENTRY_TYPES.map((t) => o.totals[t]))
  const rate: Record<EntryType, string | null> = {
    lead: null,
    appuntamento: o.rates.appointmentRate === null ? null : `${pct(o.rates.appointmentRate)} dei lead`,
    preventivo: o.rates.quoteRate === null ? null : `${pct(o.rates.quoteRate)} degli appuntamenti`,
    vendita: o.rates.saleRate === null ? null : `${pct(o.rates.saleRate)} dei lead`,
  }
  return (
    <div className="space-y-2">
      {ENTRY_TYPES.map((t) => (
        <div key={t} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
          <span className="text-muted-foreground">{TYPE_LABEL[t]}</span>
          <div className="h-6 overflow-hidden rounded-md bg-muted/50">
            <div className="h-full rounded-md bg-primary/70" style={{ width: `${Math.max(2, (o.totals[t] / max) * 100)}%` }} />
          </div>
          <span className="min-w-[140px] text-right [font-variant-numeric:tabular-nums]">
            <strong>{fmt(o.totals[t])}</strong>
            {rate[t] && <span className="ml-2 text-xs text-muted-foreground">{rate[t]}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

function BreakdownTable({ title, rows }: { title: string; rows: Breakdown[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">Nessun dato.</p> : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr><th className="px-3 py-2 text-left font-medium">{title}</th>{ENTRY_TYPES.map((t) => <th key={t} className="px-3 py-2 text-right font-medium">{TYPE_LABEL[t]}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-border/60">
                  <td className="px-3 py-1.5">{r.key}</td>
                  {ENTRY_TYPES.map((t) => <td key={t} className="px-3 py-1.5 text-right [font-variant-numeric:tabular-nums]">{fmt(r.byType[t])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function KpiConcessionariPage() {
  const { authFetch } = useAuthFetch()
  const [months, setMonths] = useState<string[] | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (m: string | null) => {
    setLoading(true); setError(null)
    try {
      const res = await authFetch(`/api/dealer-kpi/overview${m ? `?month=${m}` : ''}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      const list: string[] = json.availableMonths ?? []
      setMonths(list)
      if (!m) { setMonth(list.length ? list[list.length - 1] : null); return }
      setOverview(json.overview ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore')
    } finally { setLoading(false) }
  }, [authFetch])

  useEffect(() => { load(null) }, [load])
  useEffect(() => { if (month) load(month) }, [month, load])

  const download = () => {
    if (!overview) return
    const blob = new Blob([overviewToCsv(overview)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kpi-concessionari-${overview.month}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <ReportSectionNav />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">KPI concessionari</h1>
          <p className="text-sm text-muted-foreground">Lead, appuntamenti, preventivi e vendite di tutti i concessionari, dagli Sheet compilati dai clienti.</p>
        </div>
        <button onClick={download} disabled={!overview || overview.withData === 0} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
          <Download className="h-4 w-4" /> Scarica CSV
        </button>
      </div>

      {months && months.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {months.slice().reverse().map((m) => (
            <button key={m} onClick={() => setMonth(m)} className={`rounded-full border px-3 py-1 text-xs font-medium ${m === month ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'}`}>{monthLabel(m)}</button>
          ))}
        </div>
      )}

      {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carico i dati…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {months && months.length === 0 && !loading && (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">Nessuno Sheet ha ancora dati. Collega lo Sheet di un concessionario da «Dati reali» e premi «Rileggi gli Sheet».</p>
      )}

      {overview && (
        <>
          <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {ENTRY_TYPES.map((t) => (
              <div key={t} className="rounded-xl border border-border p-3">
                <p className="text-xs text-muted-foreground">{TYPE_LABEL[t]}</p>
                <p className="mt-1 text-2xl font-semibold [font-variant-numeric:tabular-nums]">{fmt(overview.totals[t])}</p>
              </div>
            ))}
          </section>
          <p className="text-xs text-muted-foreground">{overview.withData} concessionari su {overview.rows.length} hanno dati per {monthLabel(overview.month)}; gli altri non entrano nei totali.</p>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">Imbuto</h2>
            <Funnel o={overview} />
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">Per concessionario</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Cliente</th>
                    {ENTRY_TYPES.map((t) => <th key={t} className="px-3 py-2 text-right font-medium">{TYPE_LABEL[t]}</th>)}
                    <th className="px-3 py-2 text-right font-medium" title="Appuntamenti su lead">% App.</th>
                    <th className="px-3 py-2 text-right font-medium" title="Preventivi su appuntamenti">% Prev.</th>
                    <th className="px-3 py-2 text-right font-medium" title="Vendite su lead">% Vend.</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.rows.map((r) => (
                    <tr key={r.clientId} className="border-t border-border/60">
                      <td className="px-3 py-1.5"><Link href={`/clients/${encodeURIComponent(r.clientId)}/dealer-kpi`} className="font-medium hover:underline">{r.name}</Link></td>
                      {ENTRY_TYPES.map((t) => <td key={t} className="px-3 py-1.5 text-right [font-variant-numeric:tabular-nums]">{r.hasData ? fmt(r.byType[t]) : '—'}</td>)}
                      <td className="px-3 py-1.5 text-right text-muted-foreground">{r.hasData ? pct(r.appointmentRate) : '—'}</td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">{r.hasData ? pct(r.quoteRate) : '—'}</td>
                      <td className="px-3 py-1.5 text-right text-muted-foreground">{r.hasData ? pct(r.saleRate) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">I dati di Analytics, Meta Ads e Google Ads di un concessionario sono nella sua pagina («KPI concessionario»).</p>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <BreakdownTable title="Marca" rows={overview.byBrand} />
            <BreakdownTable title="Provenienza" rows={overview.bySource} />
          </div>
        </>
      )}
    </div>
  )
}
