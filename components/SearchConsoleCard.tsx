"use client"

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { Skeleton } from '@/components/ui/skeleton'
import { pagePath, ctrPct } from '@/lib/search-console-format'

interface Row { key: string; clicks: number; impressions: number; ctr: number; position: number }
interface Data { siteUrl: string; totals: { clicks: number; impressions: number; ctr: number; position: number }; queries: Row[]; pages: Row[] }

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
const intFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' })

function Table({ title, rows, render }: { title: string; rows: Row[]; render: (r: Row) => React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-2 text-sm font-medium text-foreground">{title}</p>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nessun dato nel periodo.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-1.5 pr-3 text-left font-medium">{title.startsWith('Query') ? 'Query' : 'Pagina'}</th>
                <th className="px-2 py-1.5 text-right font-medium">Click</th>
                <th className="px-2 py-1.5 text-right font-medium">Impression</th>
                <th className="px-2 py-1.5 text-right font-medium">CTR</th>
                <th className="pl-2 py-1.5 text-right font-medium">Pos.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border/60 last:border-0">
                  <td className="max-w-[260px] truncate py-1.5 pr-3 text-foreground" title={r.key}>{render(r)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{intFmt.format(r.clicks)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{intFmt.format(r.impressions)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{ctrPct(r.ctr)}</td>
                  <td className="pl-2 py-1.5 text-right tabular-nums text-muted-foreground">{r.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/**
 * Ricerca organica nella Panoramica: le query che portano traffico e le pagine che lo ricevono, sullo stesso periodo del
 * resto della pagina. Il dettaglio completo (100 righe, dispositivi, paesi) sta nella pagina Search Console.
 */
export function SearchConsoleCard({ clientId, days, range }: { clientId: string; days: number; range: { from: string; to: string } | null }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  // La scheda parte chiusa: i dati si chiedono solo alla prima apertura
  const [wanted, setWanted] = useState(false)

  useEffect(() => {
    if (!wanted) return
    let cancelled = false
    setLoading(true); setError(null)
    const period = range ? `from=${range.from}&to=${range.to}` : `days=${days <= 7 ? 7 : days >= 90 ? 90 : 30}`
    fetch(`${API_URL}/api/clients/${clientId}/search-console?${period}&compact=1`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
        if (!cancelled) setData(json)
      })
      .catch((e) => { if (!cancelled) { setData(null); setError(e.message) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [wanted, clientId, days, range?.from, range?.to])

  return (
    <div onClickCapture={() => setWanted(true)}>
      <CollapsibleCard
        icon={Search}
        title="Ricerca organica"
        description="Query che portano traffico e pagine più viste su Google, per il periodo selezionato."
        summary={data ? <span className="text-sm font-semibold tabular-nums">{intFmt.format(data.totals.clicks)} click</span> : undefined}
        actions={<Link href={`/clients/${clientId}/search-console`} className="text-xs font-medium text-primary hover:underline" onClickCapture={(e) => e.stopPropagation()}>Dettaglio completo</Link>}
      >
        {loading && !data && <Skeleton className="h-40 rounded-xl" />}
        {error && <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Dati non disponibili: {error}</p>}
        {data && (
          <div className={`space-y-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <p className="text-sm tabular-nums text-muted-foreground">
              {intFmt.format(data.totals.clicks)} click · {intFmt.format(data.totals.impressions)} impression · CTR {ctrPct(data.totals.ctr)} · posizione media {data.totals.position.toFixed(1)}
            </p>
            <div className="grid gap-6 lg:grid-cols-2">
              <Table title="Query principali" rows={data.queries} render={(r) => r.key} />
              <Table title="Pagine principali" rows={data.pages} render={(r) => pagePath(r.key)} />
            </div>
          </div>
        )}
      </CollapsibleCard>
    </div>
  )
}
