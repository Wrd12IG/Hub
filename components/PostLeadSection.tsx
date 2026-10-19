"use client"

import React, { useMemo, useRef, useState } from 'react'
import { Download, GitBranch, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { Button } from '@/components/ui/button'
import { formatEuro } from '@/lib/format'
import {
  STAGES, STAGE_LABEL, TEMPLATE_CSV, byChannel, funnelByMonth, mergeEntries, parsePostLeadRows, rate,
  type PostLeadData,
} from '@/lib/post-lead'

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''
// Il Hub imposta .tabular-nums con il font monospazio: qui basta l'allineamento delle cifre
const NUM = '[font-variant-numeric:tabular-nums]'
const intFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' })
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  const s = new Date(y, mo - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const th = 'px-3 py-2 text-xs font-medium text-muted-foreground'
const td = `px-3 py-2 text-sm text-right ${NUM}`
const pct = (v: number | null) => (v === null ? '—' : `${v.toLocaleString('it-IT')}%`)

/**
 * Cosa succede dopo il lead: appuntamenti, prove e vendite caricati da un file del CRM. Si salvano solo i conteggi per
 * mese, fase e canale (mai i dati dei clienti). I costi si calcolano sulla spesa ads PIANIFICATA del mese, non su quella
 * reale: servono a confrontare i mesi, non sono contabilità.
 */
export function PostLeadSection({ clientId, initial, plannedAdsByMonth, onSaved }: {
  clientId: string
  initial?: PostLeadData | null
  plannedAdsByMonth: Record<string, number>
  onSaved: (d: PostLeadData) => void
}) {
  const [data, setData] = useState<PostLeadData>(initial?.entries ? initial : { entries: [] })
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const months = useMemo(() => funnelByMonth(data.entries), [data.entries])
  const channels = useMemo(() => byChannel(data.entries), [data.entries])

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true })
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, raw: true }) as unknown[][]
      const parsed = parsePostLeadRows(rows)
      if (!parsed.entries.length) {
        toast.error('Nel file non trovo i dati', { description: 'Servono le colonne Data e Fase (Lead, Appuntamento, Prova, Vendita). Scarica il modello per vedere il formato.' })
        return
      }
      const next: PostLeadData = { entries: mergeEntries(data.entries, parsed.entries), updatedAt: new Date().toISOString(), fileName: file.name }
      const res = await fetch(`${API_URL}/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ postLead: JSON.parse(JSON.stringify(next)) }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(next); onSaved(next)
      toast.success(`${intFmt.format(parsed.read)} eventi caricati${parsed.skipped ? `, ${parsed.skipped} righe scartate` : ''}`, { description: 'I mesi presenti nel file hanno sostituito quelli già caricati.' })
    } catch (e) {
      console.error('[post-lead] upload failed:', e)
      toast.error('Impossibile leggere o salvare il file.')
    } finally { setBusy(false) }
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob(['﻿' + TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'modello-post-lead.csv'; a.click(); URL.revokeObjectURL(url)
  }

  const totals = months.reduce((s, m) => { for (const st of STAGES) s[st] += m.counts[st]; return s }, { lead: 0, appuntamento: 0, prova: 0, vendita: 0 })

  return (
    <CollapsibleCard
      icon={GitBranch}
      title="Dopo il lead"
      description="Appuntamenti, prove e vendite da un file del CRM: quanti lead arrivano davvero in concessionaria."
      summary={totals.vendita > 0 ? <span className="text-sm font-semibold text-foreground">{intFmt.format(totals.vendita)} vendite</span> : undefined}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={14} /> {busy ? 'Carico…' : 'Carica file'}</Button>
          <Button variant="ghost" size="sm" onClick={downloadTemplate}><Download size={14} /> Scarica il modello</Button>
          <p className="text-xs text-muted-foreground">Excel o CSV con una riga per evento: Data, Fase, Canale (facoltativo), Quantità (facoltativa). Dei clienti non si salva nulla: solo i conteggi.</p>
        </div>

        {months.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nessun dato caricato. Esporta dal CRM l'elenco di lead, appuntamenti, prove e vendite del mese e caricalo qui.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[820px]">
                <thead><tr className="bg-muted/50">
                  <th className={`${th} text-left`}>Mese</th>
                  {STAGES.map((s) => <th key={s} className={`${th} text-right`}>{STAGE_LABEL[s]}</th>)}
                  <th className={`${th} text-right`}>Lead → appuntamento</th>
                  <th className={`${th} text-right`}>Lead → vendita</th>
                  <th className={`${th} text-right`}>Costo per appuntamento</th>
                  <th className={`${th} text-right`}>Costo per vendita</th>
                </tr></thead>
                <tbody>
                  {months.map((m) => {
                    const spend = plannedAdsByMonth[m.month] || 0
                    return (
                      <tr key={m.month} className="border-t border-border">
                        <td className="px-3 py-2 text-sm text-foreground">{monthLabel(m.month)}</td>
                        {STAGES.map((s) => <td key={s} className={td}>{m.counts[s] > 0 ? intFmt.format(m.counts[s]) : '—'}</td>)}
                        <td className={`${td} text-muted-foreground`}>{pct(rate(m.counts.appuntamento, m.counts.lead))}</td>
                        <td className={`${td} text-muted-foreground`}>{pct(rate(m.counts.vendita, m.counts.lead))}</td>
                        <td className={`${td} text-muted-foreground`}>{spend > 0 && m.counts.appuntamento > 0 ? formatEuro(spend / m.counts.appuntamento, 0) : '—'}</td>
                        <td className={`${td} text-muted-foreground`}>{spend > 0 && m.counts.vendita > 0 ? formatEuro(spend / m.counts.vendita, 0) : '—'}</td>
                      </tr>
                    )
                  })}
                  {months.length > 1 && (
                    <tr className="border-t border-border bg-muted/30 font-semibold">
                      <td className="px-3 py-2 text-sm text-foreground">Totale</td>
                      {STAGES.map((s) => <td key={s} className={td}>{intFmt.format(totals[s])}</td>)}
                      <td className={td}>{pct(rate(totals.appuntamento, totals.lead))}</td>
                      <td className={td}>{pct(rate(totals.vendita, totals.lead))}</td>
                      <td className={td} /><td className={td} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">I costi dividono la spesa ads pianificata del mese (Meta + Google, dal piano qui sopra) per appuntamenti e vendite: sono un confronto fra mesi. Un mese senza piano mostra «—».</p>

            {channels.length > 1 && (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full">
                  <thead><tr className="bg-muted/50">
                    <th className={`${th} text-left`}>Canale</th>
                    {STAGES.map((s) => <th key={s} className={`${th} text-right`}>{STAGE_LABEL[s]}</th>)}
                    <th className={`${th} text-right`}>Lead → vendita</th>
                  </tr></thead>
                  <tbody>
                    {channels.map((c) => (
                      <tr key={c.channel} className="border-t border-border">
                        <td className="px-3 py-2 text-sm text-foreground">{c.channel}</td>
                        {STAGES.map((s) => <td key={s} className={td}>{c.counts[s] > 0 ? intFmt.format(c.counts[s]) : '—'}</td>)}
                        <td className={`${td} text-muted-foreground`}>{pct(rate(c.counts.vendita, c.counts.lead))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {data.updatedAt && <p className="text-xs text-muted-foreground">Ultimo caricamento: {new Date(data.updatedAt).toLocaleDateString('it-IT')}{data.fileName ? ` · ${data.fileName}` : ''}</p>}
          </>
        )}
      </div>
    </CollapsibleCard>
  )
}
