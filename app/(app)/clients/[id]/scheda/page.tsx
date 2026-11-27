"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Check, Loader2, MessageSquareText, Mail, MoreHorizontal, Phone, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { btn } from '@/app/(app)/outreach/shared'
import { LOG_TYPES, LOG_TYPE_LABEL, typeText, type LogEntry, type LogType } from '@/lib/client-scheda/types'
import type { SchedaClient } from '@/lib/client-scheda/whitelist'
import Link from 'next/link'
import { useLayoutData } from '@/app/(app)/layout-context'
import { ClientQuickLinks } from '@/components/client-quick-links'
import { clientWorkSummary } from '@/lib/client-work-summary'

type Payload = { client: SchedaClient; entries: LogEntry[]; nextBefore: string | null; canDecide: boolean }
type Sent = { entry: LogEntry; emails: { sent: number; failed: number } }

const TYPE_ICON: Record<LogType, typeof Phone> = { telefonata: Phone, email: Mail, richiesta: MessageSquareText, riunione: Users, altro: MoreHorizontal }
const MAX_TEXT = 2000
const MAX_TYPE_LABEL = 60
const fmt = (iso: string) => new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })
const APPROVAL: Record<string, { label: string; cls: string }> = {
  in_attesa: { label: 'In attesa di approvazione', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  approvata: { label: 'Approvata', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  rifiutata: { label: 'Rifiutata', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
}

export default function ClientSchedaPage() {
  const { id } = useParams() as { id: string }
  const { authFetch } = useAuthFetch()
  const { currentUser, allTasks, isLoadingWorkData, clientsById } = useLayoutData()
  const isStaff = !!currentUser && currentUser.role !== 'Cliente'
  const [data, setData] = useState<Payload | null>(null)
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [next, setNext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [pendingOnly, setPendingOnly] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [type, setType] = useState<LogType>('telefonata')
  const [typeLabel, setTypeLabel] = useState('')
  const [text, setText] = useState('')
  const [ask, setAsk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, string>>({})

  const load = useCallback(async (before?: string) => {
    const qs = new URLSearchParams()
    if (before) qs.set('before', before)
    if (pendingOnly) qs.set('pending', '1')
    try {
      const res = await authFetch(`/api/clients/${id}/scheda?${qs}`)
      const json = await res.json().catch(() => ({}))
      if (res.status === 404 || res.status === 403) { setDenied(true); return }
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      setData(json)
      setEntries((prev) => (before ? [...prev, ...json.entries] : json.entries))
      setNext(json.nextBefore)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore di caricamento')
    } finally {
      setLoading(false)
    }
  }, [authFetch, id, pendingOnly])
  useEffect(() => { setLoading(true); load() }, [load])

  const reportEmails = (r: Sent) => {
    if (r.emails.failed > 0) toast.warning(`Salvato, ma ${r.emails.failed} email non ${r.emails.failed === 1 ? 'è partita' : 'sono partite'}.`)
  }

  const save = async () => {
    setSaving(true)
    try {
      const res = await authFetch(`/api/clients/${id}/scheda/log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, typeLabel: type === 'altro' ? typeLabel : undefined, text, requestApproval: ask }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      toast.success(ask ? 'Riga registrata e richiesta inviata.' : 'Riga registrata.')
      reportEmails(json as Sent)
      setText(''); setTypeLabel(''); setAsk(false); setFormOpen(false)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const decide = async (logId: string, decision: 'approvata' | 'rifiutata') => {
    setBusy(logId)
    try {
      const res = await authFetch(`/api/clients/${id}/scheda/log/${logId}/decision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, comment: comments[logId] ?? '' }) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      toast.success(decision === 'approvata' ? 'Richiesta approvata.' : 'Richiesta rifiutata.')
      reportEmails(json as Sent)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore')
    } finally {
      setBusy(null)
    }
  }

  if (loading && !data) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
  if (denied || !data) return <p className="p-6 text-sm text-muted-foreground">Non hai accesso alla scheda di questo cliente, oppure il cliente non esiste.</p>
  const c = data.client
  const row = (label: string, value: React.ReactNode) => value ? <div className="flex gap-2 text-sm"><dt className="w-28 shrink-0 text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{value}</dd></div> : null

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold">{c.name}</h1>
        <p className="text-sm text-muted-foreground">Scheda cliente e registro delle interazioni</p>
      </header>

      {/* Da qui si arriva a tutto il lavoro sul cliente: prima la scheda era un vicolo cieco */}
      {isStaff && <ClientQuickLinks clientId={id} kpiProfile={clientsById[id]?.kpiProfile} />}

      {isStaff && (() => {
        const sum = clientWorkSummary(allTasks, id)
        const cells: Array<{ label: string; value: number; tone?: string }> = [
          { label: 'Task aperti', value: sum.open },
          { label: 'Scaduti', value: sum.overdue, tone: sum.overdue > 0 ? 'text-red-600' : undefined },
          { label: 'In approvazione', value: sum.inApproval, tone: sum.inApproval > 0 ? 'text-amber-600' : undefined },
          { label: 'Attesa cliente', value: sum.waitingClient },
        ]
        return (
          <Link href={`/clients/${id}/tasks`} className="grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-xl border border-border bg-border hover:border-primary/40 transition-colors" aria-label="Apri i task del cliente">
            {cells.map((cell) => (
              <div key={cell.label} className="bg-background p-3">
                <div className={`text-2xl font-semibold tabular-nums ${cell.tone ?? ''}`}>
                  {isLoadingWorkData ? <span className="inline-block h-7 w-8 rounded bg-muted animate-pulse align-middle" /> : cell.value}
                </div>
                <div className="text-xs text-muted-foreground">{cell.label}</div>
              </div>
            ))}
          </Link>
        )
      })()}

      <section className="rounded-xl border border-border p-4">
        <dl className="space-y-1.5">
          {row('Email', c.email && <a className="underline" href={`mailto:${c.email}`}>{c.email}</a>)}
          {row('Telefono', c.phone && <a className="underline" href={`tel:${c.phone}`}>{c.phone}</a>)}
          {row('Indirizzo', c.address)}
          {row('Sito', c.websiteUrl && <a className="underline" href={c.websiteUrl} target="_blank" rel="noopener noreferrer">{c.websiteUrl}</a>)}
          {row('Social', c.social.length > 0 && c.social.map((s) => <a key={s.platform} className="mr-3 underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.platform}</a>))}
          {row('Responsabili', c.managers.join(', '))}
          {row('PM di backup', c.backupManager)}
          {row('Note', c.notes && <span className="whitespace-pre-wrap">{c.notes}</span>)}
        </dl>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Registro</h2>
          <div className="flex gap-2">
            {data.canDecide && <button className={btn} aria-pressed={pendingOnly} onClick={() => setPendingOnly((v) => !v)}>Solo in attesa</button>}
            <button className={btn} onClick={() => setFormOpen((v) => !v)}><Plus className="h-4 w-4" /> Nuova riga</button>
          </div>
        </div>

        {formOpen && (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">La data viene registrata in automatico al salvataggio. Le righe non si possono modificare: per correggere, aggiungi una nuova riga.</p>
            <div>
              <p className="mb-2 text-sm font-medium">Tipo di interazione</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo di interazione">
                {LOG_TYPES.map((t) => {
                  const Icon = TYPE_ICON[t]
                  const on = type === t
                  return (
                    <button
                      key={t} type="button" role="radio" aria-checked={on} onClick={() => setType(t)}
                      className={`inline-flex h-10 items-center gap-2 rounded-lg border-2 px-4 text-sm font-semibold transition-colors ${on ? 'border-primary bg-primary text-primary-foreground shadow-sm' : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}
                    >
                      {on ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      {LOG_TYPE_LABEL[t]}
                    </button>
                  )
                })}
              </div>
            </div>
            {type === 'altro' && (
              <div>
                <label htmlFor="type-label" className="mb-1 block text-sm font-medium">Che tipo di interazione?</label>
                <input
                  id="type-label" autoFocus maxLength={MAX_TYPE_LABEL} value={typeLabel} onChange={(e) => setTypeLabel(e.target.value)}
                  placeholder="Es. sopralluogo, WhatsApp, incontro in fiera…"
                  className="h-10 w-full rounded-lg border-2 border-primary/60 bg-background px-3 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            )}
            <textarea className="min-h-[100px] w-full rounded-lg border border-border bg-background p-2 text-sm" placeholder="Cosa è successo con il cliente?" maxLength={MAX_TEXT} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ask} onChange={(e) => setAsk(e.target.checked)} /> Richiedi approvazione (arriva una email agli amministratori)</label>
              <span className="text-xs text-muted-foreground">{text.length}/{MAX_TEXT}</span>
            </div>
            <div className="flex gap-2">
              <button className={btn} disabled={saving || !text.trim() || (type === 'altro' && !typeLabel.trim())} onClick={save}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Registra</button>
              <button className={btn} disabled={saving} onClick={() => setFormOpen(false)}>Annulla</button>
            </div>
          </div>
        )}

        {entries.length === 0 && <p className="text-sm text-muted-foreground">{pendingOnly ? 'Nessuna richiesta in attesa.' : 'Nessuna riga ancora: usa «Nuova riga».'}</p>}
        {entries.map((e) => {
          const ap = e.approval ? APPROVAL[e.approval.status] : null
          return (
            <article key={e.id} className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded bg-muted px-1.5 py-0.5 text-foreground">{typeText(e)}</span>
                <span>{fmt(e.createdAt)}</span><span>· {e.authorName}</span>
                {ap && <span className={`rounded px-1.5 py-0.5 ${ap.cls}`}>{ap.label}</span>}
              </div>
              <p className="whitespace-pre-wrap">{e.text}</p>
              {e.approval && e.approval.status !== 'in_attesa' && (
                <p className="text-xs text-muted-foreground">Deciso da {e.approval.decidedByName} il {e.approval.decidedAt ? fmt(e.approval.decidedAt) : ''}{e.approval.comment ? ` — «${e.approval.comment}»` : ''}</p>
              )}
              {e.approval?.status === 'in_attesa' && data.canDecide && (
                <div className="flex flex-wrap items-center gap-2">
                  <input className="h-8 min-w-[200px] flex-1 rounded-lg border border-border bg-background px-2 text-sm" placeholder="Commento (facoltativo)" maxLength={500} value={comments[e.id] ?? ''} onChange={(ev) => setComments((p) => ({ ...p, [e.id]: ev.target.value }))} />
                  <button className={btn} disabled={busy === e.id} onClick={() => decide(e.id, 'approvata')}>Approva</button>
                  <button className={btn} disabled={busy === e.id} onClick={() => decide(e.id, 'rifiutata')}>Rifiuta</button>
                </div>
              )}
            </article>
          )
        })}
        {next && <button className={btn} onClick={() => load(next)}>Carica altre</button>}
      </section>
    </div>
  )
}
