"use client"

import React from 'react'
import { Calendar } from 'lucide-react'
import { presetRange, type RangeCheck } from '@/lib/date-range'

const todayIso = () => new Date().toISOString().slice(0, 10)
const fieldClass = 'px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm font-medium text-foreground outline-none focus:border-primary/60'

/**
 * Selettore del periodo della Panoramica: gli intervalli di sempre più «Personalizzato…», con due date.
 * Lo stato sta nella pagina; qui c'è solo l'interfaccia. Finché le date non sono valide (inizio dopo la fine, futuro,
 * oltre 366 giorni) l'errore è scritto accanto e la pagina continua a usare l'ultimo periodo buono.
 */
export function PeriodPicker({
  mode, daysBack, from, to, check, onPreset, onCustom, onFrom, onTo,
}: {
  mode: 'preset' | 'custom'
  daysBack: number
  from: string
  to: string
  check: RangeCheck | null
  onPreset: (days: number) => void
  /** Passa a «Personalizzato»: riceve l'intervallo con cui partire (quello in uso, da correggere). */
  onCustom: (start: { from: string; to: string }) => void
  onFrom: (v: string) => void
  onTo: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Calendar className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold text-foreground">Periodo:</span>
      </div>
      <select
        aria-label="Periodo"
        value={mode === 'custom' ? 'custom' : daysBack}
        onChange={(e) => {
          if (e.target.value === 'custom') onCustom(from && to ? { from, to } : presetRange(daysBack))
          else onPreset(Number(e.target.value))
        }}
        className="px-3 py-1.5 rounded-lg border border-border bg-background/50 hover:border-foreground/30 text-sm font-medium outline-none cursor-pointer transition-colors text-foreground"
      >
        <option value={7}>Ultimi 7 Giorni</option>
        <option value={30}>Ultimi 30 Giorni</option>
        <option value={60}>Ultimi 60 Giorni</option>
        <option value={90}>Ultimi 90 Giorni</option>
        <option value={180}>Ultimi 6 Mesi</option>
        <option value="custom">Personalizzato…</option>
      </select>
      {mode === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            Dal
            <input type="date" value={from} max={to || todayIso()} onChange={(e) => onFrom(e.target.value)} className={fieldClass} />
          </label>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            al
            <input type="date" value={to} min={from || undefined} max={todayIso()} onChange={(e) => onTo(e.target.value)} className={fieldClass} />
          </label>
          {check && !check.ok ? (
            <span className="text-xs font-medium text-red-700 dark:text-red-400">{check.error}</span>
          ) : check?.ok ? (
            <span className="text-xs text-muted-foreground">{check.days} giorni</span>
          ) : null}
        </div>
      )}
    </div>
  )
}
