"use client"

import React, { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { hasReportSources } from '@/lib/report-warm'
import {
  KPI_PROFILES, PROFILE_DEFS, kpisForProfile, monthlyMailState, suggestionFor, isKpiProfile,
  type KpiProfile,
} from '@/lib/kpi-profiles'

type Row = { kpiProfile?: KpiProfile | null; monthlyKpiMail?: boolean }

const select = 'h-9 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground'

/**
 * Mail mensile dei KPI — Fase 1: a ogni cliente si assegna un profilo (che decide quali KPI guardare) e si accende o
 * spegne il flag «Nella mail». Opt-in: un cliente nuovo non compare finché non lo accendi. Non invia nulla.
 */
export default function ReportMensilePage() {
  const { authFetch } = useAuthFetch()
  const { currentUser, clients, refetchData } = useLayoutData()
  const [overrides, setOverrides] = useState<Record<string, Row>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [bulk, setBulk] = useState(false)
  const [search, setSearch] = useState('')

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...clients]
      .map((c: any) => ({ c, v: { kpiProfile: c.kpiProfile ?? null, monthlyKpiMail: c.monthlyKpiMail === true, ...overrides[c.id] } as Row }))
      .filter(({ c }) => !q || String(c.name || '').toLowerCase().includes(q))
      .sort((a, b) => String(a.c.name).localeCompare(String(b.c.name), 'it', { sensitivity: 'base' }))
  }, [clients, overrides, search])

  const counts = useMemo(() => {
    const k = { included: 0, excluded: 0, no_profile: 0 }
    for (const { v } of rows) k[monthlyMailState(v)]++
    return k
  }, [rows])

  async function patch(id: string, body: Row): Promise<boolean> {
    const res = await authFetch(`/api/clients/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.error || `Errore ${res.status}`)
    }
    return true
  }

  async function save(id: string, body: Row) {
    setSaving((s) => ({ ...s, [id]: true }))
    try {
      await patch(id, body)
      setOverrides((o) => ({ ...o, [id]: { ...o[id], ...body } }))
    } catch (e: any) { toast.error(e.message || 'Impossibile salvare') }
    finally { setSaving((s) => ({ ...s, [id]: false })) }
  }

  // Solo i clienti senza profilo e senza flag: una scelta già fatta non si sovrascrive mai
  const toFill = useMemo(() => clients.flatMap((c: any) => {
    if (c.kpiProfile || c.monthlyKpiMail !== undefined || overrides[c.id]) return []
    const s = suggestionFor(c.name)
    return s ? [{ id: c.id as string, body: { kpiProfile: s.profile, monthlyKpiMail: s.include } as Row }] : []
  }), [clients, overrides])

  async function applySuggested() {
    if (!window.confirm(`Applico la proposta a ${toFill.length} clienti che non hanno ancora né profilo né flag? Le scelte già fatte non vengono toccate.`)) return
    setBulk(true)
    let ok = 0, ko = 0
    for (const { id, body } of toFill) {
      try { await patch(id, body); setOverrides((o) => ({ ...o, [id]: body })); ok++ } catch { ko++ }
    }
    setBulk(false)
    if (ko) toast.error(`${ok} salvati, ${ko} non salvati: riprova`)
    else toast.success(`Proposta applicata a ${ok} clienti`)
    await refetchData('clients')
  }

  if (currentUser?.role !== 'Amministratore') return <p className="p-6 text-sm text-muted-foreground">Pagina riservata agli amministratori.</p>

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mail mensile dei KPI</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Scegli per ogni cliente il profilo (decide quali KPI guardare) e se entra nella mail. È una sola mail con tutti i clienti.
            Un cliente nuovo non compare finché non accendi «Nella mail».
          </p>
        </div>
        <button type="button" onClick={applySuggested} disabled={bulk || toFill.length === 0}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
          {bulk && <Loader2 size={14} className="animate-spin" />}
          Applica proposta iniziale ({toFill.length})
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span><b>{counts.included}</b> nella mail</span>
        <span><b>{counts.excluded}</b> esclusi</span>
        {counts.no_profile > 0 && <span className="text-amber-700 dark:text-amber-400"><b>{counts.no_profile}</b> con flag acceso ma senza profilo</span>}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca cliente…" aria-label="Cerca cliente"
          className="ml-auto h-9 w-56 rounded-lg border border-border bg-background px-3 text-sm" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2 w-56">Profilo</th>
              <th className="px-3 py-2 w-28 text-center">Nella mail</th>
              <th className="px-3 py-2 w-40">Dati collegati</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, v }) => {
              const state = monthlyMailState(v)
              return (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2">
                    <select aria-label={`Profilo di ${c.name}`} className={select} disabled={!!saving[c.id]}
                      value={v.kpiProfile ?? ''}
                      onChange={(e) => save(c.id, { kpiProfile: isKpiProfile(e.target.value) ? e.target.value : null })}>
                      <option value="">Nessun profilo</option>
                      {KPI_PROFILES.map((p) => <option key={p} value={p}>{PROFILE_DEFS[p].label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" aria-label={`${c.name} nella mail`} className="h-4 w-4 cursor-pointer"
                      checked={v.monthlyKpiMail === true} disabled={!!saving[c.id]}
                      onChange={(e) => save(c.id, { monthlyKpiMail: e.target.checked })} />
                    {state === 'no_profile' && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">serve un profilo</p>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {hasReportSources(c) ? 'Collegati' : <span className="text-amber-700 dark:text-amber-400">Nessuna fonte</span>}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Nessun cliente.</td></tr>}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Cosa guarda ogni profilo</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {KPI_PROFILES.map((p) => (
            <div key={p} className="rounded-xl border border-border p-3">
              <p className="text-sm font-semibold">{PROFILE_DEFS[p].label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{PROFILE_DEFS[p].description}</p>
              <p className="mt-2 text-xs">{kpisForProfile(p).map((k) => k.label).join(' · ')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
