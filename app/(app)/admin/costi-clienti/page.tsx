"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { formatEuro } from '@/lib/format'
import type { AllocateMode, LabourReport } from '@/lib/labour-cost'

const hoursFmt = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: 'always' })
const monthName = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  const s = new Date(y, mo - 1, 1).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const th = 'px-3 py-2 text-xs font-medium text-muted-foreground text-right'
const td = 'px-3 py-2 text-sm text-right [font-variant-numeric:tabular-nums]'

/** Costo del lavoro interno per cliente: ore registrate × costo orario di chi le ha fatte. Solo amministratori. */
export default function CostiClientiPage() {
  const { authFetch } = useAuthFetch()
  const { currentUser } = useLayoutData()
  const [months, setMonths] = useState(3)
  const [allocate, setAllocate] = useState<AllocateMode>('none')
  const [data, setData] = useState<(LabourReport & { sources: { tasks: number; activities: number; users: number } }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await authFetch(`/api/admin/labour-cost?months=${months}&allocate=${allocate}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `Errore ${res.status}`)
      setData(j)
    } catch (e: any) { setError(e.message); setData(null) } finally { setLoading(false) }
  }, [authFetch, months, allocate])

  useEffect(() => { if (currentUser?.role === 'Amministratore') load() }, [load, currentUser?.role])

  if (currentUser?.role !== 'Amministratore') return <p className="p-6 text-sm text-muted-foreground">Pagina riservata agli amministratori.</p>

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Costi per cliente</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Costo del lavoro interno: ore registrate su task e attività di calendario per il costo orario di chi le ha fatte (30 €/h se nel profilo manca). La stima mensile è la media dei mesi completi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
        <label className="text-xs font-medium text-muted-foreground">Lavoro interno
          <select className="ml-2 h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground" value={allocate} onChange={(e) => setAllocate(e.target.value as AllocateMode)}>
            <option value="none">Riga a parte</option>
            <option value="proportional">Ripartito in proporzione alle ore</option>
            <option value="equal">Ripartito in parti uguali</option>
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">Mesi per la stima
          <select className="ml-2 h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[1, 3, 6, 12].map((n) => <option key={n} value={n}>{n === 1 ? 'Ultimo mese' : `Ultimi ${n} mesi`}</option>)}
          </select>
        </label>
        </div>
      </div>

      {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Calcolo…</p>}
      {error && <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Dati non disponibili: {error}</p>}

      {data && !loading && (
        data.clients.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nessuna ora registrata nel periodo.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Cliente</th>
                  {data.months.map((m) => <th key={m} className={th}>{monthName(m)}</th>)}
                  <th className={th}>{monthName(data.current)} (finora)</th>
                  <th className={`${th} text-foreground`}>Stima mensile diretta</th>
                  {data.hourlyOverhead > 0 && <th className={`${th} text-foreground`}>Stima mensile piena</th>}
                  <th className={th}>Ore / mese</th>
                </tr>
              </thead>
              <tbody>
                {data.clients.map((c) => (
                  <tr key={c.clientId} className="border-t border-border">
                    <td className="px-3 py-2 text-sm text-foreground">{c.name}</td>
                    {data.months.map((m) => <td key={m} className={`${td} text-muted-foreground`}>{c.byMonth[m] ? formatEuro(c.byMonth[m].cost, 0) : '—'}</td>)}
                    <td className={`${td} text-muted-foreground`}>{c.currentMonth.cost > 0 ? formatEuro(c.currentMonth.cost, 0) : '—'}</td>
                    <td className={`${td} font-semibold text-foreground`}>{formatEuro(c.monthlyCost, 0)}</td>
                    {data.hourlyOverhead > 0 && <td className={`${td} font-semibold text-foreground`}>{formatEuro(c.monthlyFullCost, 0)}</td>}
                    <td className={`${td} text-muted-foreground`}>{hoursFmt.format(c.monthlyHours)}</td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/30 font-semibold">
                  <td className="px-3 py-2 text-sm text-foreground">Totale</td>
                  {data.months.map((m) => <td key={m} className={td}>{formatEuro(data.clients.reduce((s, c) => s + (c.byMonth[m]?.cost ?? 0), 0), 0)}</td>)}
                  <td className={td}>{formatEuro(data.total.currentMonth.cost, 0)}</td>
                  <td className={td}>{formatEuro(data.total.monthlyCost, 0)}</td>
                  {data.hourlyOverhead > 0 && <td className={td}>{formatEuro(data.total.monthlyFullCost, 0)}</td>}
                  <td className={td}>{hoursFmt.format(data.total.monthlyHours)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      )}
      {data && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p><span className="font-medium text-foreground">Diretta</span> = ore × costo orario del profilo. {data.hourlyOverhead > 0
            ? <><span className="font-medium text-foreground">Piena</span> = diretta + sovrapprezzo dei costi aziendali ({formatEuro(data.hourlyOverhead)}/h: dirigenza, struttura e varie ÷ collaboratori e PM attivi ÷ 160 ore).</>
            : <>I costi aziendali non sono impostati (Admin → Costi Aziendali): il costo pieno non si può calcolare.</>}</p>
          <p>
            {data.allocate === 'none'
              ? <>La riga «Senza cliente» raccoglie le ore di task e attività non collegati a nessun cliente: sono nel totale. Scegli «Lavoro interno» in alto per ripartirle sui clienti.</>
              : data.allocate === 'proportional'
                ? <>Il lavoro interno è ripartito mese per mese sui clienti che in quel mese hanno lavoro, in proporzione alle loro ore. Un mese senza lavoro sui clienti lascia le ore interne nella riga «Senza cliente». Il totale non cambia.</>
                : <>Il lavoro interno è ripartito mese per mese in parti uguali fra i clienti che in quel mese hanno lavoro. Un mese senza lavoro sui clienti lascia le ore interne nella riga «Senza cliente». Il totale non cambia.</>}
            {' '}Non contano i task senza tempo registrato.
          </p>
        </div>
      )}
      {data && <p className="text-xs text-muted-foreground">Fonti: {data.sources.tasks} task con tempo registrato, {data.sources.activities} attività di calendario, {data.sources.users} utenti. Un'attività con più clienti si divide in parti uguali.</p>}
    </div>
  )
}
