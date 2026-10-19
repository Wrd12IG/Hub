"use client"

import React, { useState } from 'react'
import { Pencil, PiggyBank } from 'lucide-react'
import { toast } from 'sonner'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { Button } from '@/components/ui/button'
import { computeBudgetPace, type PaceTone } from '@/lib/budget-pace'
import { summarizeReport } from '@/lib/report-metrics'
import { formatEuro } from '@/lib/format'
import type { MarketingReportState } from '@/hooks/use-marketing-report'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
const intFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' })

const TONE: Record<PaceTone, string> = {
  good: 'text-emerald-700 dark:text-emerald-400',
  warn: 'text-amber-700 dark:text-amber-400',
  bad: 'text-red-700 dark:text-red-400',
  neutral: 'text-muted-foreground',
}
const BAR: Record<PaceTone, string> = { good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-red-500', neutral: 'bg-muted-foreground' }

function Progress({ pct, tone }: { pct: number; tone: PaceTone }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${BAR[tone]}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  )
}

/**
 * Budget pubblicitario e obiettivo mensili messi a confronto con il ritmo del periodo selezionato, con le proposte
 * che ne discendono (lib/budget-pace.ts). Budget e obiettivo si impostano qui e restano sul cliente.
 */
export function BudgetGoalsCard({
  clientId, report, days, adBudget, target, onSaved,
}: {
  clientId: string
  report: MarketingReportState
  days: number
  adBudget?: number
  target?: number
  onSaved: (v: { adBudgetMonthly?: number; resultTargetMonthly?: number }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState('')
  const [targetDraft, setTargetDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const startEdit = () => {
    setBudgetDraft(adBudget ? String(adBudget) : '')
    setTargetDraft(target ? String(target) : '')
    setEditing(true)
  }

  const parse = (v: string): number | null | undefined => {
    const t = v.trim().replace(',', '.')
    if (!t) return null
    const n = Number(t)
    return Number.isFinite(n) && n >= 0 ? n : undefined
  }

  const save = async () => {
    const b = parse(budgetDraft)
    const t = parse(targetDraft)
    if (b === undefined || t === undefined) { toast.error('Inserisci solo numeri positivi'); return }
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        // 0 o vuoto = non impostato: si salva 0 perché Firestore non accetta undefined
        body: JSON.stringify({ adBudgetMonthly: b ?? 0, resultTargetMonthly: t ?? 0 }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onSaved({ adBudgetMonthly: b || undefined, resultTargetMonthly: t || undefined })
      setEditing(false)
      toast.success('Budget e obiettivo salvati')
    } catch (e) {
      console.error('[budget] save failed:', e)
      toast.error('Impossibile salvare. Riprova.')
    } finally {
      setSaving(false)
    }
  }

  const summary = report.platforms ? summarizeReport(report.platforms, days) : null
  const pace = summary
    ? computeBudgetPace({
        budget: adBudget, target, spend: summary.spend?.value ?? null, result: summary.result?.value ?? null,
        resultLabel: summary.result?.label, costPerResult: summary.costPerResult, periodDays: days,
      })
    : null

  const inputCls = 'h-9 w-40 rounded-lg border border-border bg-background px-3 text-sm tabular-nums'

  return (
    <CollapsibleCard
      icon={PiggyBank}
      title="Budget e obiettivi"
      description="Spesa e risultati del periodo rispetto a quanto concordato, con le proposte per riallinearli."
      summary={pace?.budget ? <span className={`text-sm font-semibold ${TONE[pace.budget.tone]}`}>{pace.budget.usedPct}% del budget</span> : undefined}
      actions={<Button variant="ghost" size="sm" onClick={startEdit} aria-label="Modifica budget e obiettivo"><Pencil size={14} /> Modifica</Button>}
    >
      <div className="space-y-5">
        {editing && (
          <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border p-4">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Budget pubblicitario mensile (€)
              <input className={`${inputCls} block`} inputMode="decimal" value={budgetDraft} onChange={(e) => setBudgetDraft(e.target.value)} placeholder="es. 1500" />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Obiettivo mensile di risultati
              <input className={`${inputCls} block`} inputMode="numeric" value={targetDraft} onChange={(e) => setTargetDraft(e.target.value)} placeholder="es. 120 lead" />
            </label>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Salvo…' : 'Salva'}</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Annulla</Button>
            </div>
          </div>
        )}

        {!adBudget && !target && !editing && (
          <p className="text-sm text-muted-foreground">Imposta il budget mensile e l'obiettivo di risultati per vedere se il cliente è in linea e ricevere proposte. Usa «Modifica».</p>
        )}

        {!pace && (adBudget || target) && <p className="text-sm text-muted-foreground">In attesa dei dati del periodo…</p>}

        {pace?.budget && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Budget</p>
              <p className="text-sm tabular-nums text-muted-foreground">
                Speso nel periodo {formatEuro(pace.budget.spent, 0)} · previsto {formatEuro(pace.budget.planned, 0)} · budget mensile {formatEuro(pace.budget.monthly, 0)}
              </p>
            </div>
            <Progress pct={pace.budget.usedPct} tone={pace.budget.tone} />
            <p className={`text-xs font-semibold ${TONE[pace.budget.tone]}`}>Proiezione a fine mese {formatEuro(pace.budget.projected, 0)} ({pace.budget.usedPct}%)</p>
          </div>
        )}

        {pace?.goal && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">Obiettivo: {pace.goal.label}</p>
              <p className="text-sm tabular-nums text-muted-foreground">Nel periodo {intFmt.format(pace.goal.achieved)} · obiettivo mensile {intFmt.format(pace.goal.monthly)}</p>
            </div>
            <Progress pct={pace.goal.reachedPct} tone={pace.goal.tone} />
            <p className={`text-xs font-semibold ${TONE[pace.goal.tone]}`}>Proiezione a fine mese {intFmt.format(pace.goal.projected)} ({pace.goal.reachedPct}%)</p>
          </div>
        )}

        {pace && pace.proposals.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Proposte</p>
            <ul className="space-y-2">
              {pace.proposals.map((p, i) => (
                <li key={i} className={`rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm ${p.tone === 'neutral' ? 'text-muted-foreground' : 'text-foreground'}`}>
                  <span className={`mr-2 font-semibold ${TONE[p.tone]}`}>{p.tone === 'good' ? 'In linea' : p.tone === 'warn' ? 'Da sistemare' : p.tone === 'bad' ? 'Attenzione' : 'Nota'}</span>{p.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </CollapsibleCard>
  )
}
