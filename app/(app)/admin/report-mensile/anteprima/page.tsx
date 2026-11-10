"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { isMonthKey, previousMonthKey } from '@/lib/manual-kpis'
import { buildMonthlyMail } from '@/lib/monthly-mail-html'
import type { ClientMonthly } from '@/lib/kpi-compute'

type Snap = { computedAt: string; result: ClientMonthly }
type Included = { id: string; name: string }

const btn = 'inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
const CONCURRENCY = 2

/**
 * Anteprima della mail mensile. «Calcola» legge le piattaforme di ogni cliente per il mese (10-40 secondi a cliente, due alla
 * volta) e ne salva la fotografia; la mail qui sotto è costruita da quelle fotografie, uguale a quella che partirà.
 * «Invia prova a me» la manda SOLO al tuo indirizzo.
 */
export default function AnteprimaPage() {
  const { authFetch } = useAuthFetch()
  const { currentUser } = useLayoutData()
  const [month, setMonth] = useState(previousMonthKey())
  const [included, setIncluded] = useState<Included[]>([])
  const [snaps, setSnaps] = useState<Record<string, Snap>>({})
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const stop = useRef(false)

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

  /** `onlyMissing`: solo chi non ha ancora la fotografia (per riprendere dopo un errore senza rifare tutto). */
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

  async function sendTest() {
    setSending(true)
    try {
      const res = await authFetch('/api/admin/monthly-kpi-mail/send-test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `Errore ${res.status}`)
      toast.success(`Prova inviata a ${j.sentTo} da ${j.from} (${j.clients} clienti${j.missing ? `, ${j.missing} non calcolati` : ''}). Se non arriva in pochi minuti guarda anche lo spam.`, { duration: 12000 })
    } catch (e: any) { toast.error(e.message || 'Invio non riuscito') }
    finally { setSending(false) }
  }

  const missing = useMemo(() => included.filter((c) => !snaps[c.id]), [included, snaps])
  const mail = useMemo(() => {
    const clients = included.map((c) => snaps[c.id]?.result).filter((r): r is ClientMonthly => !!r)
    return clients.length ? buildMonthlyMail({ month, clients, baseUrl: typeof window !== 'undefined' ? window.location.origin : '' }) : null
  }, [included, snaps, month])

  if (!currentUser) return null
  if (currentUser.role !== 'Amministratore') return <p className="p-6 text-sm text-muted-foreground">Pagina riservata agli amministratori.</p>

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
      <div>
        <Link href="/admin/report-mensile" className="text-xs text-muted-foreground hover:underline">← Mail mensile KPI</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Anteprima della mail</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Calcola i KPI dei clienti nella mail per il mese scelto e guarda la mail com&apos;è. La prova va solo al tuo indirizzo.
          I confronti sono con il mese precedente e con lo stesso mese dell&apos;anno scorso.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-muted-foreground">Mese
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} disabled={running}
            className="mt-1 block h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground" />
        </label>
        <button type="button" className={btn} disabled={running || loading || missing.length === 0} onClick={() => run(missing)}>
          {running && <Loader2 size={14} className="animate-spin" />} Calcola i mancanti ({missing.length})
        </button>
        <button type="button" className={btn} disabled={running || loading || included.length === 0}
          onClick={() => { if (window.confirm(`Ricalcolo tutti i ${included.length} clienti? Richiede alcuni minuti.`)) run(included) }}>
          Ricalcola tutti
        </button>
        {running && <button type="button" className={btn} onClick={() => { stop.current = true }}>Ferma</button>}
        <button type="button" disabled={!mail || sending || running} onClick={sendTest}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
          {sending && <Loader2 size={14} className="animate-spin" />} Invia prova a me
        </button>
      </div>

      {running && <p className="text-sm">Calcolo… <b>{progress.done}</b> di {progress.total}. Lascia aperta la pagina.</p>}
      {Object.keys(errors).length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <p className="font-semibold">Non calcolati ({Object.keys(errors).length}) — premi «Calcola i mancanti» per riprovare:</p>
          <ul className="mt-1 list-disc pl-5">{included.filter((c) => errors[c.id]).map((c) => <li key={c.id}>{c.name}: {errors[c.id]}</li>)}</ul>
        </div>
      )}

      {loading ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Carico…</p>
        : included.length === 0 ? <p className="text-sm text-muted-foreground">Nessun cliente nella mail: accendi «Nella mail» e assegna un profilo.</p>
        : mail ? (
          <>
            <p className="text-xs text-muted-foreground">
              {Object.keys(snaps).length} clienti calcolati su {included.length} · in calo {mail.counts.down}, stabili {mail.counts.flat}, in crescita {mail.counts.up}, dati insufficienti {mail.counts.unknown} · {Math.round(mail.bytes / 1024)} KB
            </p>
            <iframe title="Anteprima mail" srcDoc={mail.html} sandbox="" className="h-[75vh] w-full rounded-xl border border-border bg-white" />
          </>
        ) : <p className="text-sm text-muted-foreground">Nessun cliente ancora calcolato per questo mese: premi «Calcola i mancanti».</p>}
    </div>
  )
}
