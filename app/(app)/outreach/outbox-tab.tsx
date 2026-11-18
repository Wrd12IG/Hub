"use client"

import React, { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import type { OutreachCompanyItem, OutreachOutboxItem } from '@/lib/outreach'
import { btn, fmt, type Pending } from './shared'

const STATUS: Record<string, { label: string; cls: string }> = {
  pending_review: { label: 'Da rivedere', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  approved: { label: 'Approvata', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  sending: { label: 'In invio', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  sent: { label: 'Inviata', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  rejected: { label: 'Rifiutata', cls: 'bg-muted text-muted-foreground' },
  cancelled: { label: 'Annullata', cls: 'bg-muted text-muted-foreground' },
  failed: { label: 'Fallita', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
}

type Props = {
  outbox: OutreachOutboxItem[]
  companies: OutreachCompanyItem[]
  pending: Pending[]
  busy: string | null
  decide: (id: string, action: 'approve' | 'reject') => void
  openId: string | null
  setOpenId: (id: string | null) => void
}

export function OutboxTab({ outbox, companies, pending, busy, decide, openId, setOpenId }: Props) {
  const wantedFor = useMemo(() => new Map(pending.filter((p) => p.outboxId).map((p) => [p.outboxId as string, p.action])), [pending])
  const [filter, setFilter] = useState<'all' | 'pending_review'>('all')
  const rows = useMemo(
    () =>
      outbox
        .filter((o) => filter === 'all' || o.status === 'pending_review')
        .sort((a, b) => (a.status === 'pending_review' ? 0 : 1) - (b.status === 'pending_review' ? 0 : 1) || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    [outbox, filter],
  )

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Email</h2>
          <div className="flex gap-2">
            <button className={btn} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Tutte</button>
            <button className={btn} aria-pressed={filter === 'pending_review'} onClick={() => setFilter('pending_review')}>Da rivedere</button>
          </div>
        </div>
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Nessuna email.</p>}
        {rows.map((o) => {
          const wanted = wantedFor.get(o.id)
          const st = STATUS[o.status] ?? STATUS.failed
          return (
            <div key={o.id} id={`email-${o.id}`} className="rounded-lg border border-border">
              <button className="flex w-full items-center justify-between gap-3 p-3 text-left" onClick={() => setOpenId(openId === o.id ? null : o.id)}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{o.subject || '(senza oggetto)'}</div>
                  <div className="truncate text-xs text-muted-foreground">{o.company || o.to} · {o.to} · {o.kind === 'reply' ? 'risposta' : `passo ${o.step}`}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{wanted ? 'In attesa di Sellbird' : st.label}</span>
              </button>
              {openId === o.id && (
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
        <h2 className="text-lg font-medium">Aziende trovate ({companies.length})</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="p-2 font-medium">Azienda</th><th className="p-2 font-medium">Zona</th><th className="p-2 text-right font-medium">Contatti</th><th className="p-2 text-right font-medium">Inviate</th><th className="p-2 font-medium">Risposta</th></tr></thead>
            <tbody>
              {companies.map((c) => (
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
