"use client"

import React, { useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { formatEuro } from '@/lib/format'
import type { ChartMetric } from '@/lib/report-metrics'
import type { MetricRow } from '@/lib/report-series'

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
const axisTick = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' }
const intFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' })

/**
 * Andamento giornaliero di UNA metrica alla volta, scelta con le schede sopra il grafico: ogni piattaforma ha le sue
 * (Instagram: copertura, visualizzazioni, mi piace, nuovi follower; GA4: sessioni, utenti, eventi chiave…).
 * Le metriche senza nessun valore nel periodo non compaiono fra le schede: un grafico piatto sembrerebbe un dato.
 */
export function PlatformDailyChart({ rows, metrics, height = 220 }: { rows: MetricRow[]; metrics: ChartMetric[]; height?: number }) {
  const available = useMemo(
    () => metrics.filter((m) => rows.some((r) => typeof r[m.key] === 'number' && (r[m.key] as number) > 0)),
    [rows, metrics],
  )
  const [selected, setSelected] = useState<string | null>(null)
  if (rows.length < 2 || available.length === 0) return null

  const metric = available.find((m) => m.key === selected) ?? available[0]
  const fmt = (v: number) => (metric.unit === 'euro' ? formatEuro(v) : intFmt.format(v))
  const data = rows.map((r) => ({ date: r.date, value: typeof r[metric.key] === 'number' ? (r[metric.key] as number) : 0 }))
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex flex-wrap rounded-lg border border-border p-0.5 text-xs font-semibold" role="tablist" aria-label="Metrica del grafico">
          {available.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={m.key === metric.key}
              onClick={() => setSelected(m.key)}
              className={`rounded-md px-2.5 py-1.5 transition-colors cursor-pointer ${m.key === metric.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Totale nel periodo: <strong className="text-foreground">{fmt(total)}</strong></p>
      </div>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tickFormatter={dayLabel} tick={axisTick} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => (metric.unit === 'euro' ? `€${v}` : intFmt.format(v))} />
            <RTooltip
              formatter={(v: number) => [fmt(v), metric.label]}
              labelFormatter={(l: string) => new Date(`${l}T00:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })}
              contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }}
            />
            {metric.kind === 'bar'
              ? <Bar dataKey="value" name={metric.label} fill="hsl(var(--primary) / 0.45)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              : <Line type="monotone" dataKey="value" name={metric.label} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
