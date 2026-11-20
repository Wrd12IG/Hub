"use client"

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Play, Square } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { btn } from '@/app/(app)/outreach/shared'
import type { ScanRecord } from '@/lib/site-monitor/store'

type Row = { id: string; name: string; websiteUrl: string; enabled: boolean; lastScanAt: string | null; assignees: number; creditsMonth: number }
type Result = { status: 'in corso' | 'ok' | 'parziale' | 'budget_esaurito' | 'errore'; text: string }

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('it-IT', { dateStyle: 'short' }) : 'mai')

export default function SiteMonitorOverviewPage() {
  const { currentUser } = useLayoutData()
  const { authFetch } = useAuthFetch()
  const isAdmin = currentUser?.role === 'Amministratore'
  const [rows, setRows] = useState<Row[]>([])
  const [spent, setSpent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<Record<string, Result>>({})
  const [running, setRunning] = useState(false)
  const stop = useRef(false)

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/site-monitor')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      setRows(json.clients)
      setSpent(json.spentThisMonth)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore di caricamento')
    } finally {
      setLoading(false)
    }
  }, [authFetch])
  useEffect(() => { if (isAdmin) load(); else setLoading(false) }, [isAdmin, load])

  const scanOne = async (r: Row): Promise<Result['status']> => {
    setResults((p) => ({ ...p, [r.id]: { status: 'in corso', text: 'Scansione in corso…' } }))
    try {
      const res = await authFetch(`/api/site-monitor/${r.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'scan' }) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      const s = json.scan as ScanRecord
      const text = s.status === 'budget_esaurito'
        ? `Non fatta: ${s.note ?? 'crediti esauriti'}`
        : `${s.pagesScanned} pagine · ${s.creditsUsed} crediti · ${s.findingsNew} nuovi problemi`
      setResults((p) => ({ ...p, [r.id]: { status: s.status, text } }))
      return s.status
    } catch (e) {
      setResults((p) => ({ ...p, [r.id]: { status: 'errore', text: e instanceof Error ? e.message : 'Errore' } }))
      return 'errore'
    }
  }

  // Cliente dopo cliente, in sequenza: così i crediti si contano prima di ogni scansione e ci si ferma al primo «budget esaurito».
  const scanAll = async () => {
    stop.current = false
    setRunning(true)
    for (const r of rows.filter((x) => x.enabled)) {
      if (stop.current) break
      const st = await scanOne(r)
      if (st === 'budget_esaurito') { toast.warning('Crediti esauriti: mi fermo qui.'); break }
    }
    setRunning(false)
    await load()
  }

  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Solo gli amministratori possono usare il Monitor siti.</p>
  if (loading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Monitor siti</h1>
          <p className="text-sm text-muted-foreground">{rows.length} clienti con un sito · crediti spesi questo mese: {spent}</p>
        </div>
        {running
          ? <button className={btn} onClick={() => { stop.current = true }}><Square className="h-4 w-4" /> Ferma dopo questo</button>
          : <button className={btn} onClick={scanAll}><Play className="h-4 w-4" /> Scansiona tutti</button>}
      </header>
      <p className="text-xs text-muted-foreground">Ogni scansione legge fino a 25 pagine (1 credito a pagina). Sola lettura sul sito del cliente. Lascia aperta questa pagina finché non finisce.</p>
      <div className="space-y-1">
        {rows.map((r) => {
          const res = results[r.id]
          return (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
              <div className="min-w-0">
                <Link href={`/clients/${r.id}/site-monitor`} className="font-medium underline-offset-2 hover:underline">{r.name}</Link>
                <p className="truncate text-xs text-muted-foreground">{r.websiteUrl} · ultima scansione: {fmt(r.lastScanAt)}{r.assignees === 0 ? ' · nessun utente designato' : ''}</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                {res?.status === 'in corso' && <Loader2 className="h-4 w-4 animate-spin" />}
                {res && <span className={res.status === 'errore' || res.status === 'budget_esaurito' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}>{res.text}</span>}
                <button className={btn} disabled={running} onClick={() => scanOne(r).then(load)}>Scansiona</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
