"use client"

import React from 'react'
import type { OutreachStats } from '@/lib/outreach'
import { intentOf, PROSPECT_STATUS } from './shared'

const nf = new Intl.NumberFormat('it-IT')

function Card({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-2xl font-semibold">{nf.format(value)}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function Bars({ data, label }: { data: [string, number][]; label: (k: string) => string }) {
  const max = Math.max(1, ...data.map(([, n]) => n))
  if (data.length === 0) return <p className="text-sm text-muted-foreground">Ancora nessun dato.</p>
  return (
    <div className="space-y-1.5">
      {data.map(([k, n]) => (
        <div key={k} className="flex items-center gap-3 text-sm">
          <div className="w-40 shrink-0 truncate">{label(k)}</div>
          <div className="h-2 flex-1 rounded bg-muted"><div className="h-2 rounded bg-sky-500" style={{ width: `${(n / max) * 100}%` }} /></div>
          <div className="w-10 text-right tabular-nums">{nf.format(n)}</div>
        </div>
      ))}
    </div>
  )
}

const sorted = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1])

export function PipelineTab({ stats }: { stats: OutreachStats | null }) {
  if (!stats) return <p className="text-sm text-muted-foreground">Nessun dato: Sellbird non ha ancora sincronizzato i contatori.</p>
  const contacts = Object.values(stats.prospects).reduce((a, b) => a + b, 0)
  const u = stats.usage
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card value={stats.companies} label="Aziende trovate" />
        <Card value={contacts} label="Contatti" />
        <Card value={stats.emailsSent} label={`Email inviate (${stats.emailsSentToday} oggi)`} />
        <Card value={stats.conversations} label="Hanno risposto" />
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Contatti per stato</h2>
        <Bars data={sorted(stats.prospects)} label={(k) => PROSPECT_STATUS[k] ?? k} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Risposte per esito</h2>
        <Bars data={sorted(stats.intents)} label={(k) => intentOf(k === 'none' ? '' : k).label} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Uso di Claude, ultimi 7 giorni</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card value={u.calls7d} label="Chiamate" />
          <Card value={u.errors7d} label="Con errore" />
          <Card value={u.inputTokens7d} label="Token in ingresso" />
          <Card value={u.outputTokens7d} label="Token in uscita" />
        </div>
        <Bars data={sorted(u.byAgent)} label={(k) => k || 'altro'} />
        <p className="text-xs text-muted-foreground">Sellbird usa l&apos;abbonamento Claude, quindi non ci sono costi per chiamata: i token indicano solo quanto lavoro fa.</p>
      </section>
    </div>
  )
}
