"use client"

import React, { useMemo, useState } from 'react'
import type { OutreachOutboxItem, OutreachReplyItem } from '@/lib/outreach'
import { fmt, intentOf } from './shared'

type Props = {
  replies: OutreachReplyItem[]
  outbox: OutreachOutboxItem[]
  /** Apre la scheda Email sulla bozza di risposta indicata. */
  goToDraft: (outboxId: string) => void
}

export function RepliesTab({ replies, outbox, goToDraft }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const rows = useMemo(() => [...replies].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')), [replies])
  // Una bozza di risposta di Sellbird in attesa di approvazione, per lo stesso indirizzo.
  const draftFor = useMemo(() => {
    const m = new Map<string, OutreachOutboxItem>()
    for (const o of outbox) if (o.kind === 'reply' && o.status === 'pending_review') m.set(o.to.toLowerCase(), o)
    return m
  }, [outbox])

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nessuno ha ancora risposto.</p>

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const it = intentOf(r.intent)
        const draft = draftFor.get(r.email.toLowerCase())
        const last = r.messages[r.messages.length - 1]
        return (
          <div key={r.id} className="rounded-lg border border-border">
            <button className="flex w-full items-center justify-between gap-3 p-3 text-left" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{r.company || r.email}{r.contact ? ` · ${r.contact}` : ''}</div>
                <div className="truncate text-xs text-muted-foreground">{last ? last.text.replace(/\s+/g, ' ').slice(0, 120) : r.email}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {draft && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">Bozza di risposta</span>}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${it.cls}`}>{it.label}</span>
              </div>
            </button>
            {open === r.id && (
              <div className="space-y-3 border-t border-border p-3">
                <div className="text-xs text-muted-foreground">{r.email} · fase {r.stage || '—'} · ultimo aggiornamento {fmt(r.updatedAt)}</div>
                <div className="space-y-2">
                  {r.messages.map((m, i) => (
                    <div key={i} className={`max-w-[85%] rounded-lg p-3 text-sm ${m.from === 'them' ? 'bg-muted' : 'ml-auto bg-sky-500/10'}`}>
                      <div className="mb-1 text-xs text-muted-foreground">{m.from === 'them' ? (r.contact || 'Destinatario') : 'Noi'} · {fmt(m.at)}</div>
                      <pre className="whitespace-pre-wrap font-sans">{m.text}</pre>
                    </div>
                  ))}
                </div>
                {draft && (
                  <button className="text-sm font-medium underline underline-offset-2" onClick={() => goToDraft(draft.id)}>
                    Vai alla bozza di risposta da approvare
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
