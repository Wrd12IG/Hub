"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Printer } from 'lucide-react'
import { ReportTrendChart } from '@/components/ReportTrendChart'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { useMarketingReport } from '@/hooks/use-marketing-report'
import { buildPublicReport } from '@/lib/client-report-public'
import { buildPdfSections, buildHighlights, PDF_PERIODS, pdfRange, type PdfChart, type PdfPeriod } from '@/lib/report-pdf'
import { summarizeReport } from '@/lib/report-metrics'
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
    .paper .flow-table thead td, .paper .flow-table tfoot td { height: 14mm; vertical-align: bottom; }
  .paper .flow-table tfoot td { vertical-align: top; }
  .paper .run-head, .paper .run-foot { display: flex !important; }
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

/** Grafico piccolo a barre in SVG: niente librerie, nessun ridimensionamento in stampa. */
function MiniChart({ chart }: { chart: PdfChart }) {
  const W = 600, H = 84, PAD_B = 16
  const max = Math.max(...chart.points.map((p) => p.value), 1)
  const slot = W / chart.points.length
  const bar = Math.max(2, slot * 0.62)
  const dayLabel = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
  const fmt = (v: number) => (chart.euro ? formatEuro(v, 0) : intFmt.format(v))
  const first = chart.points[0], last = chart.points[chart.points.length - 1]
  return (
    <figure className="keep rounded-lg border border-[hsl(var(--border))] bg-white px-4 pb-2 pt-3">
      <figcaption className="mb-1 flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
        <span>{chart.label} per giorno</span><span className="normal-case tracking-normal">massimo {fmt(max)}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`${chart.label} per giorno`}>
        <line x1="0" y1={H - PAD_B} x2={W} y2={H - PAD_B} stroke="hsl(0 0% 85%)" strokeWidth="1" />
        {chart.points.map((p, i) => {
          const h = Math.max(1, (p.value / max) * (H - PAD_B - 4))
          return <rect key={p.date} x={i * slot + (slot - bar) / 2} y={H - PAD_B - h} width={bar} height={h} rx="1.5" fill="hsl(45 93% 47%)" fillOpacity="0.85" />
        })}
        <text x="0" y={H - 3} fontSize="9" fill="hsl(215 9% 38%)">{dayLabel(first.date)}</text>
        <text x={W} y={H - 3} fontSize="9" fill="hsl(215 9% 38%)" textAnchor="end">{dayLabel(last.date)}</text>
      </svg>
    </figure>
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
  const highlights = useMemo(() => (report.platforms ? buildHighlights(summarizeReport(report.platforms, days)) : []), [report.platforms, days])
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
            {pub && (pub.summary.spend || pub.summary.result) && (
              <div className="mt-14 flex gap-12">
                {pub.summary.result && (
                  <div><p className="text-3xl font-light [font-variant-numeric:tabular-nums]">{intFmt.format(pub.summary.result.value)}</p><p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-[#6e7681]">{pub.summary.result.label}</p></div>
                )}
                {pub.summary.spend && (
                  <div><p className="text-3xl font-light [font-variant-numeric:tabular-nums]">{formatEuro(pub.summary.spend.value, 0)}</p><p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-[#6e7681]">investimento ads</p></div>
                )}
                {pub.summary.costPerResult !== null && (
                  <div><p className="text-3xl font-light [font-variant-numeric:tabular-nums]">{formatEuro(pub.summary.costPerResult)}</p><p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-[#6e7681]">costo per risultato</p></div>
                )}
              </div>
            )}
            <div className="mt-10 h-px w-16 bg-[hsl(var(--primary))]" />
            <p className="mt-4 text-xs text-[#6e7681]">Preparato da W[r]Digital · {today}</p>
          </section>

          <table className="flow-table">
            <thead><tr><td><div className="run-head hidden items-end justify-between px-[14mm] pb-2 text-[9px] uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]"><span>{clientName} · Report marketing</span><span>{periodText}</span></div></td></tr></thead>
            <tfoot><tr><td><div className="run-foot hidden items-start justify-between px-[14mm] pt-2 text-[9px] tracking-[0.1em] text-[hsl(var(--muted-foreground))]"><span>W[r]Digital</span><span>hub.wrdigital.it</span></div></td></tr></tfoot>
            <tbody><tr><td>
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

              {highlights.length > 0 && (
                <div className="keep space-y-1.5">
                  <h3 className="text-sm font-semibold">In sintesi</h3>
                  <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed">
                    {highlights.map((h) => <li key={h}>{h}</li>)}
                  </ul>
                </div>
              )}

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

              {shown.length > 0 && (
                <p className="text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                  In questo report: {shown.map((x) => x.title).join(' · ')}.
                </p>
              )}
            </section>

            {/* Una sezione per piattaforma */}
            {shown.map((s) => (
              <section key={s.id} className="mt-8 space-y-3">
                {/* Titolo e grafico viaggiano insieme: il titolo non resta solo in fondo a una pagina */}
                <div className="keep space-y-3">
                  <div>
                    <h2 className="text-lg font-normal tracking-tight">{s.title}</h2>
                    <div className="mt-2 h-0.5 w-10 bg-[hsl(var(--primary))]" />
                  </div>
                  {s.chart && <MiniChart chart={s.chart} />}
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

            <div className="keep mt-10 space-y-1 text-center text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              <p>
                Dati delle piattaforme collegate{report.computedAt ? `, aggiornati il ${new Date(report.computedAt).toLocaleString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : ''} · report preparato da W[r]Digital il {today}
              </p>
              <p>I dati di Search Console arrivano con circa 2 giorni di ritardo; Meta e Google Ads possono correggere i numeri degli ultimi giorni.</p>
            </div>
          </div>
          </td></tr></tbody></table>
        </>
      )}
    </div>
  )
}
