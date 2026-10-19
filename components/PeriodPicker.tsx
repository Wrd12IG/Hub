"use client"

import React from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import type { DateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { presetRange, type RangeCheck } from '@/lib/date-range'

// yyyy-MM-dd <-> Date in ora locale (new Date('2026-09-01') sarebbe mezzanotte UTC e in Italia cade il giorno prima)
const toDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return y && m && d ? new Date(y, m - 1, d) : undefined }
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fieldClass = 'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background/50 hover:border-foreground/30 text-sm font-medium text-foreground outline-none cursor-pointer transition-colors'

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
  const range: DateRange | undefined = from ? { from: toDate(from), to: to ? toDate(to) : undefined } : undefined
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <CalendarIcon className="h-4 w-4 text-primary" />
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
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className={fieldClass} aria-label="Scegli le date">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                {range?.from ? (
                  <>{format(range.from, 'dd MMM yyyy', { locale: it })} – {range.to ? format(range.to, 'dd MMM yyyy', { locale: it }) : '…'}</>
                ) : (
                  <span className="text-muted-foreground">Seleziona le date</span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={range?.from}
                selected={range}
                onSelect={(r) => {
                  if (!r?.from) return
                  // Primo clic = un giorno solo (periodo valido); il secondo clic lo allarga
                  onFrom(toIso(r.from))
                  onTo(toIso(r.to ?? r.from))
                }}
                numberOfMonths={2}
                locale={it}
                disabled={{ after: new Date() }}
              />
            </PopoverContent>
          </Popover>
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
