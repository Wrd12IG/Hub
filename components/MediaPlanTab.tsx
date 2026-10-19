"use client"

import React, { useMemo, useRef, useState } from 'react'
import { CalendarRange, FileSpreadsheet, LineChart, Plus, SlidersHorizontal, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { Button } from '@/components/ui/button'
import { useMarketingReport } from '@/hooks/use-marketing-report'
import { computeBudgetPace, type PaceTone } from '@/lib/budget-pace'
import { summarizeReport } from '@/lib/report-metrics'
import { rangeDays } from '@/lib/date-range'
import { formatEuro } from '@/lib/format'
import {
  CHANNELS, GOOGLE_KINDS, META_KINDS, computePlan, emptyPlan, parsePlanRows,
  type Channel, type MediaPlan, type PlanAssumptions, type PlanLine, type PlanResults,
} from '@/lib/media-plan'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
const intFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' })
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  const s = new Date(y, mo - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

const TONE: Record<PaceTone, string> = {
  good: 'text-emerald-700 dark:text-emerald-400', warn: 'text-amber-700 dark:text-amber-400',
  bad: 'text-red-700 dark:text-red-400', neutral: 'text-muted-foreground',
}
const BAR: Record<PaceTone, string> = { good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-red-500', neutral: 'bg-muted-foreground' }

const inputCls = 'h-9 rounded-lg border border-border bg-background px-3 text-sm tabular-nums text-foreground'
const th = 'px-3 py-2 text-xs font-medium text-muted-foreground'
const td = 'px-3 py-2 text-sm tabular-nums'

/** Numero modificabile: si scrive come testo e si conferma uscendo dal campo. `pct` mostra la frazione come percentuale. */
function NumField({ value, onChange, pct = false, className = '' }: { value: number; onChange: (v: number) => void; pct?: boolean; className?: string }) {
  const show = (v: number) => String(Math.round((pct ? v * 100 : v) * 1000) / 1000).replace('.', ',')
  const [text, setText] = useState(show(value))
  const [focused, setFocused] = useState(false)
  const commit = () => {
    setFocused(false)
    const v = Number(text.trim().replace(',', '.'))
    if (Number.isFinite(v) && v >= 0) onChange(pct ? v / 100 : v)
    else setText(show(value))
  }
  return (
    <input className={`${inputCls} ${className}`} inputMode="decimal" value={focused ? text : show(value)}
      onFocus={() => { setText(show(value)); setFocused(true) }} onChange={(e) => setText(e.target.value)}
      onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
  )
}

// ── Andamento del mese corrente rispetto al piano ──

function MonthPace({ clientId, plan }: { clientId: string; plan: MediaPlan }) {
  const today = todayIso()
  const month = today.slice(0, 7)
  const range = useMemo(() => ({ from: `${month}-01`, to: today }), [month, today])
  const days = rangeDays(range.from, range.to)
  const report = useMarketingReport(clientId, days, 'none', true, range)
  const sum = useMemo(() => computePlan(plan), [plan])

  if (!sum.months.includes(month)) {
    return <p className="text-sm text-muted-foreground">{monthLabel(month)} non è nel piano: aggiungi le righe del mese per confrontarlo con la spesa reale.</p>
  }
  if (!report.platforms) return <p className="text-sm text-muted-foreground">{report.error ? `Dati non disponibili: ${report.error}` : 'Carico la spesa reale del mese…'}</p>

  const s = summarizeReport(report.platforms, days)
  const monthAds = sum.byChannel.Meta[month] + sum.byChannel.Google[month]
  const pace = computeBudgetPace({
    budget: monthAds, target: Math.round(sum.leadsByMonth[month]), spend: s.spend?.value ?? null, result: s.result?.value ?? null,
    resultLabel: s.result?.label, costPerResult: s.costPerResult, periodDays: days,
  })

  const Bar = ({ pct, tone }: { pct: number; tone: PaceTone }) => (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${BAR[tone]}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{monthLabel(month)}, dal 1 a oggi ({days} giorni). Spesa reale di Meta e Google Ads rispetto al piano.</p>
      {pace.budget && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Spesa ads</p>
            <p className="text-sm tabular-nums text-muted-foreground">Speso {formatEuro(pace.budget.spent, 0)} · previsto a oggi {formatEuro(pace.budget.planned, 0)} · piano del mese {formatEuro(monthAds, 0)}</p>
          </div>
          <Bar pct={pace.budget.usedPct} tone={pace.budget.tone} />
          <p className={`text-xs font-semibold ${TONE[pace.budget.tone]}`}>Proiezione a fine mese {formatEuro(pace.budget.projected, 0)} ({pace.budget.usedPct}% del piano)</p>
        </div>
      )}
      {pace.goal && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Risultati: {pace.goal.label}</p>
            <p className="text-sm tabular-nums text-muted-foreground">Finora {intFmt.format(pace.goal.achieved)} · attesi nel mese (scenario base) {intFmt.format(pace.goal.monthly)}</p>
          </div>
          <Bar pct={pace.goal.reachedPct} tone={pace.goal.tone} />
          <p className={`text-xs font-semibold ${TONE[pace.goal.tone]}`}>Proiezione a fine mese {intFmt.format(pace.goal.projected)} ({pace.goal.reachedPct}% dell'atteso)</p>
        </div>
      )}
      {pace.proposals.length > 0 && (
        <ul className="space-y-2">
          {pace.proposals.map((p, i) => (
            <li key={i} className={`rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm ${p.tone === 'neutral' ? 'text-muted-foreground' : 'text-foreground'}`}>
              <span className={`mr-2 font-semibold ${TONE[p.tone]}`}>{p.tone === 'good' ? 'In linea' : p.tone === 'warn' ? 'Da sistemare' : p.tone === 'bad' ? 'Attenzione' : 'Nota'}</span>{p.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Pagina ──

export function MediaPlanTab({ clientId, initial, onSaved }: { clientId: string; initial?: MediaPlan | null; onSaved: (p: MediaPlan) => void }) {
  const [plan, setPlan] = useState<MediaPlan>(() => (initial?.lines ? { ...emptyPlan(), ...initial, assumptions: { ...emptyPlan().assumptions, ...initial.assumptions } } : emptyPlan()))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const sum = useMemo(() => computePlan(plan), [plan])

  const edit = (fn: (p: MediaPlan) => MediaPlan) => { setPlan(fn); setDirty(true) }
  const setLine = (id: string, patch: Partial<PlanLine>) => edit((p) => ({ ...p, lines: p.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))
  const addLine = () => edit((p) => {
    const last = p.lines[p.lines.length - 1]
    const month = last?.month || todayIso().slice(0, 7)
    return { ...p, lines: [...p.lines, { id: `l-${Date.now().toString(36)}`, month, channel: 'Meta', kind: 'Lead', description: '', amount: 0 }] }
  })
  const setMeta = (kind: (typeof META_KINDS)[number], key: 'cpm' | 'frequency' | 'ctr' | 'cpl', v: number) =>
    edit((p) => ({ ...p, assumptions: { ...p.assumptions, meta: { ...p.assumptions.meta, [kind]: { ...p.assumptions.meta[kind], [key]: v } } } }))
  const setGoogle = (key: keyof PlanAssumptions['google'], v: number) => edit((p) => ({ ...p, assumptions: { ...p.assumptions, google: { ...p.assumptions.google, [key]: v } } }))

  const save = async () => {
    setSaving(true)
    try {
      const clean: MediaPlan = JSON.parse(JSON.stringify(plan))
      const res = await fetch(`${API_URL}/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ mediaPlan: clean }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onSaved(clean); setDirty(false); toast.success('Piano media salvato')
    } catch (e) {
      console.error('[media-plan] save failed:', e); toast.error('Impossibile salvare il piano. Riprova.')
    } finally { setSaving(false) }
  }

  const importXlsx = async (file: File) => {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const name = wb.SheetNames.find((n) => /piano\s*media/i.test(n)) || wb.SheetNames[0]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, blankrows: false }) as unknown[][]
      const yearMatch = rows.slice(0, 5).flat().join(' ').match(/20\d\d/) || file.name.match(/20\d\d/)
      const { lines, skipped } = parsePlanRows(rows, yearMatch ? Number(yearMatch[0]) : new Date().getFullYear())
      if (!lines.length) { toast.error('Nel file non trovo le righe del piano', { description: 'Cerco un foglio con le colonne DATA, Canale, Linea e INVESTIMENTO.' }); return }
      edit((p) => ({ ...p, lines }))
      toast.success(`${lines.length} righe importate${skipped ? `, ${skipped} scartate` : ''}`, { description: 'Controlla le ipotesi e salva.' })
    } catch (e) {
      console.error('[media-plan] import failed:', e); toast.error('Impossibile leggere il file Excel.')
    }
  }

  const cell = (v: number) => (v > 0 ? formatEuro(v, 0) : '—')
  const ResultRow = ({ label, f, hint, strong }: { label: string; f: (r: PlanResults) => string; hint?: string; strong?: boolean }) => (
    <tr className="border-t border-border">
      <td className={`px-3 py-2 text-sm ${strong ? 'font-semibold text-foreground' : 'text-foreground'}`}>{label}{hint && <span className="block text-xs font-normal text-muted-foreground">{hint}</span>}</td>
      <td className={`${td} text-right ${strong ? 'font-semibold' : ''}`}>{f(sum.base)}</td>
      <td className={`${td} text-right ${strong ? 'font-semibold' : ''}`}>{f(sum.prudent)}</td>
    </tr>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Piano degli investimenti per mese e canale, con i risultati attesi. Modifica le righe o le ipotesi e tutto si ricalcola.</p>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importXlsx(f); e.target.value = '' }} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload size={14} /> Importa da Excel</Button>
          <Button size="sm" onClick={save} disabled={!dirty || saving}>{saving ? 'Salvo…' : dirty ? 'Salva piano' : 'Salvato'}</Button>
        </div>
      </div>

      <CollapsibleCard icon={LineChart} title="Andamento del mese" description="Spesa e risultati reali del mese corrente rispetto al piano, con le proposte per riallinearli." defaultOpen>
        <MonthPace clientId={clientId} plan={plan} />
      </CollapsibleCard>

      <CollapsibleCard icon={CalendarRange} title="Riepilogo del piano" description="Quanto si investe per canale e per mese." defaultOpen
        summary={sum.total > 0 ? <span className="text-sm font-semibold tabular-nums">{formatEuro(sum.total, 0)}</span> : undefined}>
        {sum.months.length === 0 ? (
          <p className="text-sm text-muted-foreground">Il piano è vuoto: importa il foglio Excel o aggiungi le righe qui sotto.</p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full">
                <thead><tr className="bg-muted/50">
                  <th className={`${th} text-left`}>Canale</th>
                  {sum.months.map((m) => <th key={m} className={`${th} text-right`}>{monthLabel(m)}</th>)}
                  <th className={`${th} text-right`}>Totale</th><th className={`${th} text-right`}>% sul budget</th>
                </tr></thead>
                <tbody>
                  {CHANNELS.map((c) => (
                    <tr key={c} className="border-t border-border">
                      <td className="px-3 py-2 text-sm text-foreground">{c}</td>
                      {sum.months.map((m) => <td key={m} className={`${td} text-right`}>{cell(sum.byChannel[c][m])}</td>)}
                      <td className={`${td} text-right`}>{cell(sum.channelTotals[c])}</td>
                      <td className={`${td} text-right text-muted-foreground`}>{sum.total > 0 ? `${(Math.round((sum.channelTotals[c] / sum.total) * 1000) / 10).toLocaleString('it-IT')}%` : '—'}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-border bg-muted/30 font-semibold">
                    <td className="px-3 py-2 text-sm text-foreground">Totale</td>
                    {sum.months.map((m) => <td key={m} className={`${td} text-right`}>{cell(sum.monthTotals[m])}</td>)}
                    <td className={`${td} text-right`}>{cell(sum.total)}</td><td className={`${td} text-right`}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">Di cui ads (Meta + Google): <span className="font-medium tabular-nums text-foreground">{formatEuro(sum.ads, 0)}</span> ({(Math.round(sum.adsShare * 1000) / 10).toLocaleString('it-IT')}% del budget). Il resto è off line.</p>
          </div>
        )}
      </CollapsibleCard>

      <CollapsibleCard icon={FileSpreadsheet} title="Risultati attesi" description="Stime dalle ipotesi qui sotto: da verificare con i dati reali dopo i primi 30 giorni." defaultOpen
        summary={sum.base.leads > 0 ? <span className="text-sm font-semibold tabular-nums">~{intFmt.format(sum.prudent.leads)}–{intFmt.format(sum.base.leads)} lead</span> : undefined}>
        {sum.total === 0 ? <p className="text-sm text-muted-foreground">Servono righe di piano per stimare i risultati.</p> : (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full">
                <thead><tr className="bg-muted/50"><th className={`${th} text-left`}>Indicatore</th><th className={`${th} text-right`}>Base</th><th className={`${th} text-right`}>Prudente</th></tr></thead>
                <tbody>
                  <ResultRow label="Lead Meta (lordi)" f={(r) => intFmt.format(r.meta)} />
                  <ResultRow label="Lead Google (lordi)" f={(r) => intFmt.format(r.google)} hint="Search e Remarketing; YouTube e Demand Gen costruiscono pubblico" />
                  <ResultRow strong label="Lead totali (lordi)" f={(r) => intFmt.format(r.leads)} />
                  <ResultRow label="Lead qualificati" f={(r) => intFmt.format(r.qualified)} />
                  <ResultRow label="Costo per lead lordo" f={(r) => (r.cplGross ? formatEuro(r.cplGross) : '—')} hint="Solo spesa ads" />
                  <ResultRow label="Costo per lead qualificato" f={(r) => (r.cplQualified ? formatEuro(r.cplQualified) : '—')} hint="Solo spesa ads" />
                  <ResultRow label="Costo per lead su tutto il budget" f={(r) => (r.cplAllBudget ? formatEuro(r.cplAllBudget) : '—')} hint="Include l'off line" />
                  <tr className="border-t border-border"><td className="px-3 py-2 text-sm text-foreground">Reach persone Meta, fase warm-up<span className="block text-xs text-muted-foreground">Somma delle linee: include le sovrapposizioni</span></td><td className={`${td} text-right`} colSpan={2}>{intFmt.format(sum.metaWarmupReach)}</td></tr>
                  <tr className="border-t border-border"><td className="px-3 py-2 text-sm text-foreground">Click Search attesi</td><td className={`${td} text-right`} colSpan={2}>{intFmt.format(sum.searchClicks)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CollapsibleCard>

      <CollapsibleCard icon={Plus} title="Righe del piano" description="Ogni riga è un investimento di un mese su un canale e una linea.">
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[760px]">
              <thead><tr className="bg-muted/50"><th className={`${th} text-left`}>Mese</th><th className={`${th} text-left`}>Canale</th><th className={`${th} text-left`}>Linea</th><th className={`${th} text-left`}>Descrizione</th><th className={`${th} text-right`}>Investimento €</th><th className={th} /></tr></thead>
              <tbody>
                {plan.lines.map((l) => (
                  <tr key={l.id} className="border-t border-border">
                    <td className="px-2 py-1.5"><input type="month" className={inputCls} value={l.month} onChange={(e) => setLine(l.id, { month: e.target.value })} /></td>
                    <td className="px-2 py-1.5">
                      <select className={inputCls} value={l.channel} onChange={(e) => setLine(l.id, { channel: e.target.value as Channel })}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input className={`${inputCls} w-32`} list={`kinds-${l.channel}`} value={l.kind} onChange={(e) => setLine(l.id, { kind: e.target.value })} />
                      <datalist id="kinds-Meta">{META_KINDS.map((k) => <option key={k} value={k} />)}</datalist>
                      <datalist id="kinds-Google">{GOOGLE_KINDS.map((k) => <option key={k} value={k} />)}</datalist>
                    </td>
                    <td className="px-2 py-1.5"><input className={`${inputCls} w-full min-w-[220px]`} value={l.description} onChange={(e) => setLine(l.id, { description: e.target.value })} /></td>
                    <td className="px-2 py-1.5 text-right"><NumField className="w-28 text-right" value={l.amount} onChange={(v) => setLine(l.id, { amount: v })} /></td>
                    <td className="px-2 py-1.5 text-right"><Button variant="ghost" size="sm" aria-label="Elimina riga" onClick={() => edit((p) => ({ ...p, lines: p.lines.filter((x) => x.id !== l.id) }))}><Trash2 size={14} /></Button></td>
                  </tr>
                ))}
                {plan.lines.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-sm text-muted-foreground">Nessuna riga.</td></tr>}
              </tbody>
            </table>
          </div>
          <Button variant="outline" size="sm" onClick={addLine}><Plus size={14} /> Aggiungi riga</Button>
          <p className="text-xs text-muted-foreground">Linee Meta riconosciute: Warm-up, Lead, Closing. Linee Google: Search, YT-DG, Remarketing. Le altre (affissioni, giornali…) contano nel budget ma non producono lead.</p>
        </div>
      </CollapsibleCard>

      <CollapsibleCard icon={SlidersHorizontal} title="Ipotesi di resa" description="Costi e tassi con cui si stimano i risultati. Partono prudenti: correggili con i dati reali del cliente.">
        <div className="space-y-5">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full">
              <thead><tr className="bg-muted/50"><th className={`${th} text-left`}>Meta, per fase</th><th className={`${th} text-right`}>CPM €</th><th className={`${th} text-right`}>Frequenza</th><th className={`${th} text-right`}>CTR %</th><th className={`${th} text-right`}>Costo per lead €</th></tr></thead>
              <tbody>
                {META_KINDS.map((k) => (
                  <tr key={k} className="border-t border-border">
                    <td className="px-3 py-2 text-sm text-foreground">{k}</td>
                    {(['cpm', 'frequency', 'ctr', 'cpl'] as const).map((key) => (
                      <td key={key} className="px-2 py-1.5 text-right"><NumField className="w-24 text-right" pct={key === 'ctr'} value={plan.assumptions.meta[k][key]} onChange={(v) => setMeta(k, key, v)} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ['cpcSearch', 'CPC Search medio €', false], ['cvrSearch', 'Conversione Search (click → lead) %', true],
              ['cpmYtDg', 'CPM YouTube / Demand Gen €', false], ['ctrYtDg', 'CTR YouTube / Demand Gen %', true],
              ['cpcRemarketing', 'CPC Remarketing €', false], ['cvrRemarketing', 'Conversione Remarketing %', true],
              ['qualifiedShare', 'Lead Google qualificati %', true],
            ] as const).map(([key, label, pct]) => (
              <label key={key} className="space-y-1 text-xs font-medium text-muted-foreground">{label}
                <NumField className="block w-full" pct={pct} value={plan.assumptions.google[key]} onChange={(v) => setGoogle(key, v)} />
              </label>
            ))}
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Lead Meta qualificati %
              <NumField className="block w-full" pct value={plan.assumptions.metaQualifiedShare} onChange={(v) => edit((p) => ({ ...p, assumptions: { ...p.assumptions, metaQualifiedShare: v } }))} />
            </label>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">Fattore scenario prudente (0,6 = 40% di lead in meno)
              <NumField className="block w-full" value={plan.assumptions.prudentFactor} onChange={(v) => edit((p) => ({ ...p, assumptions: { ...p.assumptions, prudentFactor: v } }))} />
            </label>
          </div>
        </div>
      </CollapsibleCard>
    </div>
  )
}
