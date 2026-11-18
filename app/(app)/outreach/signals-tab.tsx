"use client"

import React, { useMemo } from 'react'
import type { OutreachSignalItem } from '@/lib/outreach'

const STATUS: Record<string, { label: string; cls: string }> = {
  confirmed: { label: 'Attivo', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  proposed: { label: 'Da confermare', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  rejected: { label: 'Escluso', cls: 'bg-muted text-muted-foreground' },
}

export function SignalsTab({ signals }: { signals: OutreachSignalItem[] }) {
  const groups = useMemo(() => {
    const m = new Map<string, OutreachSignalItem[]>()
    for (const s of signals) m.set(s.category || 'Altro', [...(m.get(s.category || 'Altro') ?? []), s])
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [signals])

  if (signals.length === 0) return <p className="text-sm text-muted-foreground">Nessun segnale ancora: compaiono dopo la prima sincronizzazione.</p>

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        I segnali sono i fatti che Sellbird raccoglie sulle aziende (se fanno pubblicità, se hanno la prenotazione online…).
        Qui sono in sola lettura: si attivano e si disattivano da Sellbird, perché alcuni costano.
      </p>
      {groups.map(([category, list]) => (
        <section key={category} className="space-y-2">
          <h2 className="text-lg font-medium capitalize">{category}</h2>
          <div className="divide-y divide-border rounded-lg border border-border">
            {list.map((s) => {
              const st = STATUS[s.status] ?? { label: s.status, cls: 'bg-muted text-muted-foreground' }
              return (
                <div key={s.code} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{s.label || s.code} <span className="font-mono text-xs text-muted-foreground">{s.code}</span></div>
                    <div className="text-xs text-muted-foreground">{s.description}</div>
                    {s.costNote && <div className="text-xs text-amber-600 dark:text-amber-400">Costo: {s.costNote}</div>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                    <span className="text-xs text-muted-foreground">{s.companies} aziende</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
