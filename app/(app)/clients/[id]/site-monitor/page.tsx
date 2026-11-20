"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { btn } from '@/app/(app)/outreach/shared'
import { TYPE_LABEL } from '@/lib/site-monitor/group'
import type { FindingRecord, MonitorState, ScanRecord } from '@/lib/site-monitor/store'

type Payload = { state: MonitorState | null; findings: FindingRecord[]; scans: ScanRecord[] }

const SEV: Record<string, { label: string; cls: string; order: number }> = {
  alta: { label: 'Alta', cls: 'bg-red-500/15 text-red-600 dark:text-red-400', order: 3 },
  media: { label: 'Media', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', order: 2 },
  bassa: { label: 'Bassa', cls: 'bg-muted text-muted-foreground', order: 1 },
}
const STATUS_LABEL: Record<string, string> = { nuovo: 'Nuovo', task_creato: 'Task creato', ignorato: 'Ignorato', risolto: 'Risolto' }
const SCAN_NOTE: Record<string, string> = {
  tetto_mensile: 'Tetto mensile di crediti raggiunto.',
  riserva: 'I crediti rimasti sono sotto la riserva: scansione non fatta.',
  crediti_non_leggibili: 'Non riesco a leggere i crediti Firecrawl: scansione non fatta.',
}
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—')

export default function SiteMonitorPage() {
  const { id } = useParams() as { id: string }
  const { currentUser, users } = useLayoutData()
  const { authFetch } = useAuthFetch()
  const isAdmin = currentUser?.role === 'Amministratore'
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [show, setShow] = useState<'nuovo' | 'tutti'>('nuovo')

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`/api/site-monitor/${id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      setData(json)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore di caricamento')
    } finally {
      setLoading(false)
    }
  }, [authFetch, id])
  useEffect(() => { if (isAdmin) load(); else setLoading(false) }, [isAdmin, load])

  const post = async (body: Record<string, unknown>, label: string) => {
    setBusy(label)
    try {
      const res = await authFetch(`/api/site-monitor/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      await load()
      return json
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore')
      return null
    } finally {
      setBusy(null)
    }
  }

  const scan = async () => {
    const r = await post({ action: 'scan' }, 'scan')
    if (!r) return
    const s = r.scan as ScanRecord
    if (s.status === 'budget_esaurito') toast.warning(SCAN_NOTE[s.note ?? ''] ?? 'Crediti esauriti: scansione non fatta.')
    else toast.success(`Scansione fatta: ${s.pagesScanned} pagine, ${s.findingsNew} problemi nuovi, ${s.creditsUsed} crediti.`)
  }
  const createTasks = async () => {
    const r = await post({ action: 'create_tasks', fingerprints: Array.from(picked) }, 'tasks')
    if (!r) return
    setPicked(new Set())
    if (r.reason === 'nessun_utente_designato') toast.warning('Scegli prima almeno un utente designato.')
    else toast.success(`Task creati: ${r.created}${r.skipped ? ` (${r.skipped} già presenti o recenti)` : ''}.`)
  }
  const ignore = async () => {
    const r = await post({ action: 'ignore', fingerprints: Array.from(picked) }, 'ignore')
    if (r) { setPicked(new Set()); toast.success(`Ignorati: ${r.ignored}.`) }
  }
  const toggleAssignee = (uid: string) => {
    const cur = new Set(data?.state?.assigneeIds ?? [])
    if (cur.has(uid)) cur.delete(uid); else cur.add(uid)
    post({ action: 'settings', assigneeIds: Array.from(cur) }, 'settings')
  }

  const rows = useMemo(
    () => (data?.findings ?? [])
      .filter((f) => (show === 'tutti' ? true : f.status === 'nuovo'))
      .sort((a, b) => (SEV[b.severity]?.order ?? 0) - (SEV[a.severity]?.order ?? 0) || a.url.localeCompare(b.url)),
    [data, show],
  )
  const staff = useMemo(() => users.filter((u) => u.role !== 'Cliente' && u.status !== 'Inattivo'), [users])
  const assignees = new Set(data?.state?.assigneeIds ?? [])
  const selectable = rows.filter((r) => r.status === 'nuovo')
  const toggle = (fp: string) => setPicked((p) => { const n = new Set(p); if (n.has(fp)) n.delete(fp); else n.add(fp); return n })

  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Solo gli amministratori possono usare il Monitor sito.</p>
  if (loading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
  const last = data?.scans?.[0]

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Monitor sito</h1>
          <p className="text-sm text-muted-foreground">
            Contenuti scaduti, errori e immagini da sistemare. Scansione automatica ogni mese
            {data?.state?.lastScanAt ? ` · ultima: ${fmt(data.state.lastScanAt)}` : ' · mai fatta'}.
          </p>
        </div>
        <button className={btn} onClick={scan} disabled={busy !== null}>
          {busy === 'scan' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Scansiona ora
        </button>
      </header>

      {last && last.status !== 'ok' && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Ultima scansione {last.status === 'parziale' ? 'parziale' : 'non completata'}: {SCAN_NOTE[last.note ?? ''] ?? last.note ?? ''}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Utenti designati per i task</h2>
        <p className="text-xs text-muted-foreground">I task nascono assegnati a turno a queste persone. Senza nessuno scelto non nasce alcun task.</p>
        <div className="flex flex-wrap gap-2">
          {staff.map((u) => (
            <button key={u.id} className={btn} aria-pressed={assignees.has(u.id)} disabled={busy !== null} onClick={() => toggleAssignee(u.id)}>
              {assignees.has(u.id) ? '✓ ' : ''}{u.name}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Problemi trovati ({rows.length})</h2>
          <div className="flex flex-wrap gap-2">
            <button className={btn} aria-pressed={show === 'nuovo'} onClick={() => setShow('nuovo')}>Da gestire</button>
            <button className={btn} aria-pressed={show === 'tutti'} onClick={() => setShow('tutti')}>Tutti</button>
            <button className={btn} disabled={selectable.length === 0} onClick={() => setPicked(picked.size === selectable.length ? new Set() : new Set(selectable.map((r) => r.fingerprint)))}>
              {picked.size === selectable.length && selectable.length > 0 ? 'Deseleziona' : 'Seleziona tutti'}
            </button>
            <button className={btn} disabled={picked.size === 0 || busy !== null} onClick={createTasks}>
              {busy === 'tasks' && <Loader2 className="h-4 w-4 animate-spin" />} Crea task ({picked.size})
            </button>
            <button className={btn} disabled={picked.size === 0 || busy !== null} onClick={ignore}>Ignora ({picked.size})</button>
          </div>
        </div>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">{data?.scans?.length ? 'Nessun problema da gestire.' : 'Nessuna scansione ancora: premi «Scansiona ora».'}</p>}
        {rows.map((f) => {
          const sev = SEV[f.severity] ?? SEV.bassa
          return (
            <label key={f.fingerprint} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" className="mt-1" disabled={f.status !== 'nuovo'} checked={picked.has(f.fingerprint)} onChange={() => toggle(f.fingerprint)} />
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs ${sev.cls}`}>{sev.label}</span>
                  <span className="font-medium">{TYPE_LABEL[f.type]}</span>
                  <span className="text-xs text-muted-foreground">{STATUS_LABEL[f.status]}</span>
                </span>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-muted-foreground underline">{f.url}</a>
                <span className="block">{f.evidence}</span>
              </span>
            </label>
          )
        })}
      </section>

      {data && data.scans.length > 0 && (
        <section className="space-y-1">
          <h2 className="text-sm font-medium">Ultime scansioni</h2>
          {data.scans.map((s) => (
            <p key={s.id} className="text-xs text-muted-foreground">
              {fmt(s.startedAt)} · {s.pagesScanned} pagine · {s.creditsUsed} crediti · {s.findingsNew} nuovi · {s.findingsResolved} risolti{s.status !== 'ok' ? ` · ${s.status}` : ''}
            </p>
          ))}
        </section>
      )}
    </div>
  )
}
