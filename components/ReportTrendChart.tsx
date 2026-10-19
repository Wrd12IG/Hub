"use client"

import React, { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { formatEuro } from '@/lib/format'
import type { TrendPoint } from '@/lib/report-series'

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
const axisTick = { fontSize: 12, fill: 'hsl(var(--muted-foreground))' }

function TrendTooltip({ active, payload, label, resultLabel }: any) {
  if (!active || !payload?.length) return null
  const p: TrendPoint = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{new Date(`${label}T00:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })}</p>
      <p className="text-muted-foreground">Spesa: <strong className="text-foreground">{formatEuro(p.spend)}</strong></p>
      {p.results !== null && <p className="text-muted-foreground">{resultLabel}: <strong className="text-foreground">{p.results}</strong></p>}
      {p.costPerResult !== null && <p className="text-muted-foreground">Costo per {resultLabel.toLowerCase()}: <strong className="text-foreground">{formatEuro(p.costPerResult)}</strong></p>}
      {p.costPerResult7d !== null && <p className="text-muted-foreground">Media 7 giorni: <strong className="text-foreground">{formatEuro(p.costPerResult7d)}</strong></p>}
    </div>
  )
}

/**
 * Andamento giornaliero: spesa (barre) e risultato (linea), oppure il costo per risultato (giorno e media su 7 giorni).
 * Il costo del singolo giorno è molto rumoroso (un giorno senza lead non ha costo): per questo c'è la media mobile.
 */
export function ReportTrendChart({ points, resultLabel, height = 260 }: { points: TrendPoint[]; resultLabel: string; height?: number }) {
  const [view, setView] = useState<'spesa' | 'costo'>('spesa')
  const hasResults = points.some((p) => p.results !== null)
  const noun = resultLabel.toLowerCase()

  return (
    <div>
      {hasResults && (
        <div className="mb-3 inline-flex rounded-lg border border-border p-0.5 text-xs font-semibold" role="tablist">
          {([['spesa', `Spesa e ${noun}`], ['costo', `Costo per ${noun}`]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setView(key)}
              className={`rounded-md px-3 py-1.5 transition-colors cursor-pointer ${view === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tickFormatter={dayLabel} tick={axisTick} tickLine={false} axisLine={false} minTickGap={28} />
            {view === 'spesa' ? (
              <>
                <YAxis yAxisId="left" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} />
                {hasResults && <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />}
                <RTooltip content={<TrendTooltip resultLabel={resultLabel} />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Bar yAxisId="left" dataKey="spend" name="Spesa €" fill="hsl(var(--primary) / 0.35)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                {hasResults && <Line yAxisId="right" type="monotone" dataKey="results" name={resultLabel} stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />}
              </>
            ) : (
              <>
                <YAxis yAxisId="left" tick={axisTick} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} />
                <RTooltip content={<TrendTooltip resultLabel={resultLabel} />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Line yAxisId="left" type="monotone" dataKey="costPerResult" name="Costo del giorno" stroke="hsl(var(--primary) / 0.45)" strokeWidth={1.5} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
                <Line yAxisId="left" type="monotone" dataKey="costPerResult7d" name="Media 7 giorni" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} connectNulls isAnimationActive={false} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
