"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import type { OutreachCompanyItem, OutreachOutboxItem } from '@/lib/outreach'

type Meta = { syncedAt: string; outboxCounts: Record<string, number>; companies: number }
type Overview = {
  meta: Meta | null
  outbox: OutreachOutboxItem[]
  companies: OutreachCompanyItem[]
  pending: { outboxId: string; action: 'approve' | 'reject' }[]
}

/** Il ponte sincronizza ogni pochi minuti: oltre questa soglia vuol dire che Sellbird o il ponte sono fermi. */
const STALE_MINUTES = 30

const STATUS: Record<string, { label: string; cls: string }> = {
  pending_review: { label: 'Da rivedere', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  approved: { label: 'Approvata', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  sending: { label: 'In invio', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  sent: { label: 'Inviata', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  rejected: { label: 'Rifiutata', cls: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Annullata', cls: 'bg-muted text-muted-foreground' },
  failed: { label: 'Fallita', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
}
const btn = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—')

export default function OutreachPage() {
  const { currentUser } = useLayoutData()
  const { authFetch } = useAuthFetch()
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const isAdmin = currentUser?.role === 'Amministratore'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/outreach/overview')
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Errore ${res.status}`)
      setData(await res.json())
    } catch (e: any) {
      toast.error(e.message || 'Impossibile caricare Outreach')
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  const decide = async (id: string, action: 'approve' | 'reject') => {
    setBusy(id)
    try {
      const res = await authFetch(`/api/outreach/outbox/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Errore ${res.status}`)
      toast.success(action === 'approve' ? 'Approvazione registrata: Sellbird la applica entro pochi minuti.' : 'Rifiuto registrato: Sellbird lo applica entro pochi minuti.')
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  const pendingFor = useMemo(() => new Map((data?.pending ?? []).map((p) => [p.outboxId, p.action])), [data])
  const rows = useMemo(
    () => [...(data?.outbox ?? [])].sort((a, b) => (a.status === 'pending_review' ? 0 : 1) - (b.status === 'pending_review' ? 0 : 1) || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    [data],
  )

  if (!currentUser) return null
  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Pagina riservata agli amministratori.</p>

  const minutes = data?.meta ? Math.round((Date.now() - new Date(data.meta.syncedAt).getTime()) / 60000) : null
  const stale = minutes === null || minutes > STALE_MINUTES
  const counts = data?.meta?.outboxCounts ?? {}

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Outreach</h1>
          <p className="text-sm text-muted-foreground">Email di prospezione preparate da Sellbird. Nulla parte senza la tua approvazione.</p>
        </div>
        <button className={btn} onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Aggiorna
        </button>
      </div>

      {stale && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {minutes === null
            ? 'Sellbird non ha mai sincronizzato. Controlla che il ponte sia acceso sul computer di Sellbird.'
            : `Ultima sincronizzazione ${minutes} minuti fa: Sellbird o il ponte potrebbero essere fermi. Le approvazioni restano in coda finché non riparte.`}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(['pending_review', 'approved', 'sent', 'rejected'] as const).map((s) => (
          <div key={s} className="rounded-lg border border-border p-3">
            <div className="text-2xl font-semibold">{counts[s] ?? 0}</div>
            <div className="text-xs text-muted-foreground">{STATUS[s].label}</div>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Email</h2>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nessuna email ancora.</p>}
        {rows.map((o) => {
          const wanted = pendingFor.get(o.id)
          const st = STATUS[o.status] ?? STATUS.failed
          return (
            <div key={o.id} className="rounded-lg border border-border">
              <button className="flex w-full items-center justify-between gap-3 p-3 text-left" onClick={() => setOpen(open === o.id ? null : o.id)}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{o.subject || '(senza oggetto)'}</div>
                  <div className="truncate text-xs text-muted-foreground">{o.company || o.to} · {o.to} · passo {o.step}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{wanted ? 'In attesa di Sellbird' : st.label}</span>
              </button>
              {open === o.id && (
                <div className="space-y-3 border-t border-border p-3">
                  <pre className="whitespace-pre-wrap font-sans text-sm">{o.body}</pre>
                  <div className="text-xs text-muted-foreground">
                    Invio previsto: {fmt(o.sendAt)} · Inviata: {fmt(o.sentAt)}{o.error ? ` · Errore: ${o.error}` : ''}
                  </div>
                  {!wanted && (o.status === 'pending_review' || o.status === 'approved') && (
                    <div className="flex gap-2">
                      {o.status === 'pending_review' && (
                        <button className={btn} disabled={busy === o.id} onClick={() => decide(o.id, 'approve')}><Check className="h-4 w-4" /> Approva</button>
                      )}
                      <button className={btn} disabled={busy === o.id} onClick={() => decide(o.id, 'reject')}><X className="h-4 w-4" /> Rifiuta</button>
                    </div>
                  )}
                  {wanted && <p className="text-xs text-muted-foreground">Decisione registrata ({wanted === 'approve' ? 'approva' : 'rifiuta'}): in attesa che Sellbird la applichi.</p>}
                </div>
              )}
            </div>
          )
        })}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Aziende trovate ({data?.companies.length ?? 0})</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2 font-medium">Azienda</th><th className="p-2 font-medium">Zona</th><th className="p-2 text-right font-medium">Contatti</th><th className="p-2 text-right font-medium">Inviate</th><th className="p-2 font-medium">Risposta</th></tr></thead>
            <tbody>
              {(data?.companies ?? []).map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-2">{c.name}<div className="text-xs text-muted-foreground">{c.domain}</div></td>
                  <td className="p-2">{c.location || '—'}</td>
                  <td className="p-2 text-right">{c.prospects}</td>
                  <td className="p-2 text-right">{c.emailsSent}</td>
                  <td className="p-2">{c.replied ? 'Sì' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
