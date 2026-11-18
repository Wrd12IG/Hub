"use client"

import React from 'react'
import type { OutreachCampaignItem } from '@/lib/outreach'
import { fmt } from './shared'

const STATUS: Record<string, string> = { draft: 'Bozza', active: 'Attiva', paused: 'In pausa', completed: 'Conclusa', done: 'Conclusa' }

export function CampaignsTab({ campaigns }: { campaigns: OutreachCampaignItem[] }) {
  if (campaigns.length === 0) return <p className="text-sm text-muted-foreground">Nessuna campagna ancora.</p>
  return (
    <div className="space-y-3">
      {campaigns.map((c) => {
        const planned = c.prospects * Math.max(1, c.steps)
        const pct = planned > 0 ? Math.min(100, Math.round((c.sent / planned) * 100)) : 0
        return (
          <div key={c.id} className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{c.name || 'Senza nome'}</div>
                <div className="text-xs text-muted-foreground">Creata {fmt(c.createdAt)} · canale {c.channel || 'email'} · {c.steps} passi</div>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{STATUS[c.status] ?? c.status}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><div className="text-xl font-semibold">{c.prospects}</div><div className="text-xs text-muted-foreground">Contatti</div></div>
              <div><div className="text-xl font-semibold">{c.sent}</div><div className="text-xs text-muted-foreground">Email inviate</div></div>
              <div><div className="text-xl font-semibold">{c.queued}</div><div className="text-xs text-muted-foreground">In coda</div></div>
              <div><div className="text-xl font-semibold">{c.replies}</div><div className="text-xs text-muted-foreground">Risposte</div></div>
            </div>
            <div>
              <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-sky-500" style={{ width: `${pct}%` }} /></div>
              <div className="mt-1 text-xs text-muted-foreground">{pct}% delle email previste ({c.prospects} contatti × {c.steps} passi) è stato inviato.</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
