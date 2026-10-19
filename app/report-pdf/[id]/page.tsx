"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Printer } from 'lucide-react'
import { ReportTrendChart } from '@/components/ReportTrendChart'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { useMarketingReport } from '@/hooks/use-marketing-report'
import { buildPublicReport } from '@/lib/client-report-public'
import { buildPdfSections, PDF_PERIODS, pdfRange, type PdfPeriod } from '@/lib/report-pdf'
import { rangeDays, rangeLabel } from '@/lib/date-range'
import { monthLabel } from '@/lib/monthly-comment'
import { formatEuro } from '@/lib/format'

const intFmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' })

// La pagina è sempre "carta": colori fissi e chiari, indipendenti dal tema scuro del Hub, perché finisce stampata.
const PAPER_VARS = {
  '--background': '40 40% 97%', '--foreground': '0 0% 7%', '--card': '0 0% 100%', '--card-foreground': '0 0% 7%',
  '--muted': '36 20% 92%', '--muted-foreground': '215 9% 38%', '--border': '0 0% 85%', '--primary': '45 93% 47%',
} as React.CSSProperties

const PRINT_CSS = `
/* Margine zero su TUTTE le pagine: i margini veri si fanno dentro (riga di testa e di coda della tabella che avvolge il
   contenuto, che si ripetono a ogni pagina). Così non serve @page :first, che alcuni browser ignorano: la copertina
   finiva con un margine, sforava di pochi pixel e produceva pagine vuote. */
@page { size: A4; margin: 0; }
.paper { font-family: var(--font-jakarta), system-ui, sans-serif; color: hsl(var(--foreground)); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.paper .cover { width: 210mm; height: 297mm; }
.paper .flow { width: 182mm; margin: 0 auto; padding: 14mm 0; }
.paper .flow-table { width: 100%; border-collapse: collapse; }
.paper .flow-table thead td, .paper .flow-table tfoot td { height: 0; padding: 0; }
.paper .keep { break-inside: avoid; page-break-inside: avoid; }
/* Le tabelle possono continuare sulla pagina dopo (con l'intestazione ripetuta) ma una riga non si spezza e il titolo non resta solo in fondo */
.paper tr { break-inside: avoid; page-break-inside: avoid; }
.paper thead { display: table-header-group; }
/* Mai una riga sola da una parte: le prime due e le ultime due stanno insieme */
.paper tbody tr:first-child { break-after: avoid; page-break-after: avoid; }
.paper tbody tr:last-child { break-before: avoid; page-break-before: avoid; }
.paper .keep-next { break-after: avoid; page-break-after: avoid; }
@media print {
  html, body { background: #FAF7F2 !important; margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; }
  .no-print { display: none !important; }
  .paper { background: transparent !important; min-height: 0 !important; padding: 0 !important; margin: 0 !important; }
  .paper .sheet { box-shadow: none !important; margin: 0 !important; }
  /* un filo meno di 297mm: l'arrotondamento non deve spingere nulla sulla pagina dopo */
  .paper .cover { height: 296mm; overflow: hidden; break-after: page; page-break-after: always; }
  .paper .flow-table { width: 210mm; }
  .paper .flow-table thead td, .paper .flow-table tfoot td { height: 14mm; }
  .paper .flow { padding: 0; }
}
`

function Delta({ pct, good }: { pct: number | null; good: boolean | null }) {
  if (pct === null || pct === 0) return <span className="text-[hsl(var(--muted-foreground))]">—</span>
  return <span style={{ color: good === null ? 'hsl(215 9% 38%)' : good ? '#2e8b57' : '#c0392b' }} className="font-semibold">{pct > 0 ? '▲ +' : '▼ −'}{Math.abs(pct).toLocaleString('it-IT')}%</span>
}

function Kpi({ label, value, delta, hint }: { label: string; value: string; delta?: React.ReactNode; hint?: string }) {
  return (
    <div className="keep rounded-lg border border-[hsl(var(--border))] bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{label}</p>
      <p className="mt-1 text-2xl font-bold [font-variant-numeric:tabular-nums]">{value}</p>
      <p className="mt-0.5 h-4 text-[11px]">{delta}{!delta && hint ? <span className="text-[hsl(var(--muted-foreground))]">{hint}</span> : null}</p>
    </div>
  )
}

const pctDelta = (cur: number, prev: number | null) => (prev && prev !== 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null)

export default function ReportPdfPage() {
  const id = useParams().id as string
  const { authFetch } = useAuthFetch()
  // L'utente «Cliente» scarica il suo report ma non ritocca il commento di W[r]Digital
  const isClient = useLayoutData().currentUser?.role === 'Cliente'
  const [period, setPeriod] = useState<PdfPeriod>('prevMonth')
  const [clientName, setClientName] = useState('')
  const [note, setNote] = useState('')
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const range = useMemo(() => pdfRange(period), [period])
  const days = rangeDays(range.from, range.to)
  const report = useMarketingReport(id, days, 'prev_period', true, { from: range.from, to: range.to })

  useEffect(() => {
    authFetch(`/api/clients/${id}`).then((r) => (r.ok ? r.json() : null)).then((c) => { if (c?.name) setClientName(String(c.name)) }).catch(() => {})
  }, [id, authFetch])

  // Il commento dello staff per quel mese è il punto di partenza: si può ritoccare qui senza salvarlo
  useEffect(() => {
    let cancelled = false
    authFetch(`/api/clients/${id}/comments?month=${range.commentMonth}`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (!cancelled) setNote(d?.text ?? '') }).catch(() => {})
    return () => { cancelled = true }
  }, [id, range.commentMonth, authFetch])

  const sections = useMemo(() => (report.platforms ? buildPdfSections(report.platforms) : []), [report.platforms])
  const pub = useMemo(
    () => (report.platforms ? buildPublicReport({ clientName, days: 30, platforms: report.platforms, comment: null, updatedAt: report.computedAt }) : null),
    [report.platforms, clientName, report.computedAt],
  )
  const shown = sections.filter((s) => !hidden.has(s.id))
  const periodText = rangeLabel(range.from, range.to)
  const longPeriod = PDF_PERIODS.find((p) => p.id === period)?.label
  const today = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })

  const toggle = (sid: string) => setHidden((h) => { const n = new Set(h); n.has(sid) ? n.delete(sid) : n.add(sid); return n })

  return (
    <div className="paper min-h-screen bg-[#FAF7F2] pb-16 print:pb-0" style={PAPER_VARS}>
      <style>{PRINT_CSS}</style>

      {/* Comandi: non finiscono nel PDF */}
      <div className="no-print border-b border-[hsl(var(--border))] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center gap-3">
          <label className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Periodo
            <select className="ml-2 h-9 rounded-lg border border-[hsl(var(--border))] bg-white px-2 text-sm text-[hsl(var(--foreground))]" value={period} onChange={(e) => setPeriod(e.target.value as PdfPeriod)}>
              {PDF_PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">{periodText}</span>
          <button type="button" onClick={() => window.print()} disabled={!report.platforms}
            className="ml-auto inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-black disabled:opacity-50">
            <Printer size={15} /> Scarica PDF
          </button>
        </div>
        <div className="mx-auto mt-3 max-w-[210mm] space-y-3">
          {sections.length > 0 && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[hsl(var(--foreground))]">
              <span className="font-medium text-[hsl(var(--muted-foreground))]">Sezioni nel PDF:</span>
              {sections.map((s) => (
                <label key={s.id} className="inline-flex cursor-pointer items-center gap-1.5">
                  <input type="checkbox" checked={!hidden.has(s.id)} onChange={() => toggle(s.id)} /> {s.title}
                </label>
              ))}
            </div>
          )}
          {!isClient && (
          <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))]">Commento per il cliente ({monthLabel(range.commentMonth)}): si può ritoccare qui, non viene salvato
            <textarea className="mt-1 block w-full rounded-lg border border-[hsl(var(--border))] bg-white px-3 py-2 text-sm text-[hsl(var(--foreground))]" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Una nota di lettura dei risultati, in linguaggio semplice…" />
          </label>
          )}
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Nella finestra di stampa scegli «Salva come PDF» e attiva «Grafica di sfondo».</p>
        </div>
      </div>

      {!report.platforms ? (
        <div className="no-print flex flex-col items-center gap-2 py-24 text-sm text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-7 w-7 animate-spin" />
          {report.error ? `Dati non disponibili: ${report.error}` : report.progress ? `Carico i dati… ${report.progress.done}/${report.progress.total}` : 'Carico i dati…'}
        </div>
      ) : (
        <>
          {/* Copertina */}
          <section className="sheet cover relative mx-auto my-6 flex flex-col justify-end bg-[#141414] p-[22mm] text-white shadow-lg">
            {/* Logo in alto: il marchio dell'agenzia, con il nome scritto accanto */}
            <div className="absolute left-[22mm] top-[22mm] flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/Icon_512x512px.png" alt="W[r]Digital" width={64} height={64} className="h-16 w-16 rounded-xl object-contain" />
              <span className="text-2xl font-semibold tracking-tight text-white">W<span className="text-[hsl(var(--primary))]">[</span>r<span className="text-[hsl(var(--primary))]">]</span>Digital</span>
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--primary))]">Report marketing</p>
            <h1 className="mt-3 text-4xl font-light leading-tight tracking-tight">{clientName || 'Cliente'}</h1>
            <p className="mt-3 text-base text-[#9ca3af]">{longPeriod} · {periodText}</p>
            <div className="mt-16 h-px w-16 bg-[hsl(var(--primary))]" />
            <p className="mt-4 text-xs text-[#6e7681]">Preparato da W[r]Digital · {today}</p>
          </section>

          <table className="flow-table"><thead><tr><td /></tr></thead><tfoot><tr><td /></tr></tfoot><tbody><tr><td>
          <div className="flow">
            {/* Sintesi */}
            <section className="space-y-5">
              <div>
                <h2 className="text-xl font-normal tracking-tight">Sintesi del periodo</h2>
                <div className="mt-2 h-0.5 w-10 bg-[hsl(var(--primary))]" />
              </div>
              {pub && (pub.summary.spend || pub.summary.result) ? (
                <div className="grid grid-cols-3 gap-3">
                  <Kpi label="Spesa pubblicitaria" value={pub.summary.spend ? formatEuro(pub.summary.spend.value) : '—'} hint="Meta + Google Ads"
                    delta={pub.summary.spend ? <Delta pct={pctDelta(pub.summary.spend.value, pub.summary.spend.previous)} good={null} /> : undefined} />
                  <Kpi label={pub.summary.result ? pub.summary.result.label.charAt(0).toUpperCase() + pub.summary.result.label.slice(1) : 'Risultato'} value={pub.summary.result ? intFmt.format(pub.summary.result.value) : '—'} hint={pub.summary.result?.source}
                    delta={pub.summary.result ? <Delta pct={pctDelta(pub.summary.result.value, pub.summary.result.previous)} good={(pctDelta(pub.summary.result.value, pub.summary.result.previous) ?? 0) > 0} /> : undefined} />
                  <Kpi label={pub.summary.result ? `Costo per ${pub.summary.result.label}` : 'Costo per risultato'} value={pub.summary.costPerResult === null ? '—' : formatEuro(pub.summary.costPerResult)} hint="Solo canali a pagamento" />
                </div>
              ) : (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">Nessun dato di spesa o di risultato nel periodo.</p>
              )}
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Variazioni rispetto al periodo precedente di pari durata.</p>

              {note.trim() && (
                <div className="keep rounded-lg border-l-4 border-[hsl(var(--primary))] bg-[#fffbeb] px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Il nostro commento</p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed">{note.trim()}</p>
                </div>
              )}

              {pub?.trend && (
                <div className="keep rounded-lg border border-[hsl(var(--border))] bg-white p-4">
                  <h3 className="mb-2 text-sm font-semibold">Andamento giornaliero</h3>
                  <ReportTrendChart points={pub.trend.points} resultLabel={pub.trend.resultLabel} height={230} />
                </div>
              )}
            </section>

            {/* Una sezione per piattaforma */}
            {shown.map((s) => (
              <section key={s.id} className="mt-8 space-y-3">
                <div className="keep-next">
                  <h2 className="text-lg font-normal tracking-tight">{s.title}</h2>
                  <div className="mt-2 h-0.5 w-10 bg-[hsl(var(--primary))]" />
                </div>
                <table className="w-full border-collapse text-[12px]">
                  <thead>
                    <tr className="bg-[hsl(var(--primary))] text-left text-[10px] font-semibold uppercase tracking-wider text-black">
                      <th className="px-3 py-1.5">Indicatore</th><th className="px-3 py-1.5 text-right">Periodo</th><th className="px-3 py-1.5 text-right">Precedente</th><th className="px-3 py-1.5 text-right">Variazione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((r, i) => (
                      <tr key={r.label} className={i % 2 ? 'bg-[hsl(var(--muted))]' : 'bg-white'}>
                        <td className="px-3 py-1.5">{r.label}</td>
                        <td className="px-3 py-1.5 text-right font-semibold [font-variant-numeric:tabular-nums]">{r.value}</td>
                        <td className="px-3 py-1.5 text-right text-[hsl(var(--muted-foreground))] [font-variant-numeric:tabular-nums]">{r.previous ?? '—'}</td>
                        <td className="px-3 py-1.5 text-right [font-variant-numeric:tabular-nums]"><Delta pct={r.deltaPct} good={r.good} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}

            <p className="mt-10 text-center text-[11px] text-[hsl(var(--muted-foreground))]">Dati delle piattaforme collegate · report preparato da W[r]Digital il {today}</p>
          </div>
          </td></tr></tbody></table>
        </>
      )}
    </div>
  )
}
