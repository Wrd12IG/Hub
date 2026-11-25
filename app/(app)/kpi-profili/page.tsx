"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Download, Loader2 } from 'lucide-react'
import { ReportSectionNav } from '@/components/report-section-nav'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { monthLabel, shiftMonth } from '@/lib/kpi-compute'
import { KPI_PROFILES, PROFILE_DEFS, type KpiProfile } from '@/lib/kpi-profiles'
import { buildProfileOverview, cellText, deltaText, overviewToCsv, type OverviewClient, type SnapshotMap } from '@/lib/kpi-overview'
import { isAdminRole } from '@/lib/report-nav'

const MONTHS_SHOWN = 6

const toneClass = { good: 'text-emerald-600 dark:text-emerald-400', bad: 'text-red-600 dark:text-red-400', neutral: 'text-muted-foreground' } as const

function currentMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function KpiPerProfiloPage() {
  const { currentUser } = useLayoutData()
  const { authFetch } = useAuthFetch()
  const cur = useMemo(currentMonthKey, [])
  const months = useMemo(() => Array.from({ length: MONTHS_SHOWN }, (_, i) => shiftMonth(cur, -i)), [cur])
  const [profile, setProfile] = useState<KpiProfile>('auto')
  const [month, setMonth] = useState<string>(shiftMonth(cur, -1)) // l'ultimo mese chiuso: è quello della mail
  const [data, setData] = useState<{ clients: OverviewClient[]; snapshots: SnapshotMap } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0) // una risposta vecchia non deve coprire quella nuova

  const isAdmin = isAdminRole(currentUser?.role)

  const load = useCallback(async (p: KpiProfile, m: string) => {
    const n = ++request.current
    setLoading(true); setError(null)
    try {
      const res = await authFetch(`/api/admin/kpi-profili?profile=${p}&month=${m}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      if (n === request.current) setData({ clients: json.clients ?? [], snapshots: json.snapshots ?? {} })
    } catch (e) {
      if (n === request.current) { setData(null); setError(e instanceof Error ? e.message : 'Errore') }
    } finally {
      if (n === request.current) setLoading(false)
    }
  }, [authFetch])

  useEffect(() => { if (isAdmin) load(profile, month) }, [isAdmin, profile, month, load])

  const overview = useMemo(() => (data ? buildProfileOverview({ profile, month, clients: data.clients, snapshots: data.snapshots }) : null), [data, profile, month])

  const download = () => {
    if (!overview) return
    const blob = new Blob(['﻿' + overviewToCsv(overview)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `kpi-${profile}-${month}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (!currentUser) return null
  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Pagina riservata agli amministratori.</p>

  const def = PROFILE_DEFS[profile]
  const partial = overview?.rows.find((r) => r.partialDays !== null)?.partialDays ?? null

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <ReportSectionNav />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">KPI per profilo</h1>
          <p className="text-sm text-muted-foreground">I clienti dello stesso tipo affiancati, con i KPI del loro profilo. Sono i numeri già calcolati per «Andamento clienti» e per la mail mensile.</p>
        </div>
        <button onClick={download} disabled={!overview || overview.withData === 0} className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
          <Download className="h-4 w-4" /> Scarica CSV
        </button>
      </div>

      <div className="space-y-2">
        <div role="tablist" aria-label="Profilo" className="flex flex-wrap gap-1.5">
          {KPI_PROFILES.map((p) => (
            <button key={p} role="tab" aria-selected={p === profile} onClick={() => setProfile(p)} className={`rounded-full border px-3 py-1 text-xs font-medium ${p === profile ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'}`}>{PROFILE_DEFS[p].label}</button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{def.description}</p>
        <div role="tablist" aria-label="Mese" className="flex flex-wrap gap-1.5 pt-1">
          {months.map((m) => (
            <button key={m} role="tab" aria-selected={m === month} onClick={() => setMonth(m)} className={`rounded-full border px-3 py-1 text-xs font-medium ${m === month ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent'}`}>{monthLabel(m)}{m === cur ? ' (in corso)' : ''}</button>
          ))}
        </div>
      </div>

      {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carico i dati…</p>}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {overview && !loading && (
        <>
          {overview.total === 0 && (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">Nessun cliente attivo ha il profilo «{def.label}». Il profilo si sceglie da Admin → Clienti.</p>
          )}

          {overview.total > 0 && (
            <p className="text-xs text-muted-foreground">
              {overview.withData} clienti su {overview.total} hanno i numeri di {monthLabel(month)}. Gli altri vanno calcolati da <Link href="/andamento-clienti" className="underline">Andamento clienti</Link>, ma solo se entrano nella <Link href="/admin/report-mensile" className="underline">mail mensile</Link> («Nella mail» acceso).
              {partial !== null && <> Mese in corso: i numeri sono dei primi {partial} giorni.</>}
            </p>
          )}

          {overview.total > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Cliente</th>
                    {overview.columns.map((c) => <th key={c.id} className="px-3 py-2 text-right font-medium">{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {overview.rows.map((r) => (
                    <tr key={r.clientId} className="border-t border-border/60">
                      <td className="px-3 py-1.5"><Link href={`/clients/${encodeURIComponent(r.clientId)}`} className="font-medium hover:underline">{r.name}</Link></td>
                      {r.hasSnapshot
                        ? overview.columns.map((c) => {
                            const k = r.cells[c.id]
                            const tone = k?.vsPrev && !k.vsPrev.small ? k.vsPrev.tone : 'neutral'
                            return (
                              <td key={c.id} className="px-3 py-1.5 text-right [font-variant-numeric:tabular-nums]" title={k?.value === null ? k?.missing : k?.kind === 'proxy' ? 'Stima della piattaforma: manca il dato reale.' : undefined}>
                                <div>{cellText(k)}</div>
                                <div className={`text-[11px] ${toneClass[tone]}`}>{deltaText(k)}</div>
                              </td>
                            )
                          })
                        : <td colSpan={Math.max(1, overview.columns.length)} className="px-3 py-1.5 text-right text-xs text-muted-foreground">{r.inMail === false ? 'Non è nella mail mensile' : 'Da calcolare'}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {overview.withData > 0 && <p className="text-[11px] text-muted-foreground">Sotto ogni numero, la variazione rispetto al mese prima (grigia se la base è troppo piccola per un giudizio). «~» è una stima della piattaforma, «—» un dato che manca.</p>}
          {profile === 'auto' && <p className="text-[11px] text-muted-foreground">Imbuto, marca e provenienza dei lead (dagli Sheet) sono in <Link href="/kpi-concessionari" className="underline">KPI concessionari</Link>.</p>}
        </>
      )}
    </div>
  )
}
