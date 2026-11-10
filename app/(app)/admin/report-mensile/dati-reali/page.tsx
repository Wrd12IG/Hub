"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { PROFILE_DEFS, isKpiProfile, monthlyMailState } from '@/lib/kpi-profiles'
import { MANUAL_FIELDS, fieldsForProfile, isMonthKey, parseManualCsv, previousMonthKey } from '@/lib/manual-kpis'

/** Cella = testo digitato; '' = vuota. Solo le celle toccate (edits) vengono salvate. */
type Grid = Record<string, Record<string, string>>

const inputCls = 'h-8 w-20 rounded-md border border-border bg-background px-2 text-right text-sm [font-variant-numeric:tabular-nums] disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Dati reali del mese: lead arrivati davvero, appuntamenti, test drive, vendite. Sostituiscono i proxy di piattaforma nella
 * mail mensile. Una cella vuota è «dato mancante» (la mail lo dice), non zero: scrivi 0 se i lead sono davvero zero.
 */
export default function DatiRealiPage() {
  const { authFetch } = useAuthFetch()
  const { currentUser, clients } = useLayoutData()
  const [month, setMonth] = useState(previousMonthKey())
  const [server, setServer] = useState<Grid>({})
  const [edits, setEdits] = useState<Grid>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [csvNote, setCsvNote] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const included = useMemo(
    () => [...clients].filter((c: any) => monthlyMailState(c) === 'included' && fieldsForProfile(isKpiProfile(c.kpiProfile) ? c.kpiProfile : null).length > 0)
      .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), 'it', { sensitivity: 'base' })),
    [clients],
  )

  const load = useCallback(async () => {
    if (!isMonthKey(month)) return
    setLoading(true)
    try {
      const res = await authFetch(`/api/admin/manual-kpis?month=${month}`)
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `Errore ${res.status}`)
      const g: Grid = {}
      for (const [id, vals] of Object.entries(j.values ?? {})) g[id] = Object.fromEntries(Object.entries(vals as Record<string, number>).map(([k, v]) => [k, String(v)]))
      setServer(g); setEdits({})
    } catch (e: any) { toast.error(e.message || 'Impossibile leggere i dati') }
    finally { setLoading(false) }
  }, [authFetch, month])

  useEffect(() => { if (currentUser && currentUser.role !== 'Cliente') load() }, [load, currentUser])

  const cell = (id: string, f: string) => edits[id]?.[f] ?? server[id]?.[f] ?? ''
  const setCell = (id: string, f: string, v: string) => setEdits((e) => ({ ...e, [id]: { ...e[id], [f]: v } }))
  const changed = useMemo(() => {
    let n = 0
    for (const [id, fs] of Object.entries(edits)) for (const [f, v] of Object.entries(fs)) if (v !== (server[id]?.[f] ?? '')) n++
    return n
  }, [edits, server])

  async function save() {
    // Solo le celle cambiate; vuota → null (toglie il valore); non numerica → si ferma prima di inviare
    const entries: Record<string, Record<string, number | null>> = {}
    for (const [id, fs] of Object.entries(edits)) {
      for (const [f, v] of Object.entries(fs)) {
        if (v === (server[id]?.[f] ?? '')) continue
        const t = v.trim()
        if (t !== '' && !/^\d+$/.test(t)) { toast.error(`«${t}» non è un numero intero.`); return }
        ;(entries[id] ??= {})[f] = t === '' ? null : Number(t)
      }
    }
    if (Object.keys(entries).length === 0) return
    setSaving(true)
    try {
      const res = await authFetch('/api/admin/manual-kpis', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month, entries }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `Errore ${res.status}`)
      if (j.rejected?.length) toast.error(`${j.rejected.length} clienti non salvati: ${j.rejected[0].error}`)
      else toast.success(`Salvati i dati di ${j.saved.length} clienti`)
      await load()
    } catch (e: any) { toast.error(e.message || 'Impossibile salvare') }
    finally { setSaving(false) }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    const r = parseManualCsv(text, included.map((c: any) => ({ id: c.id, name: c.name })))
    if (r.errors.length && r.rows.length === 0) { setCsvNote(r.errors.join(' ')); return }
    setEdits((e) => {
      const n = { ...e }
      for (const row of r.rows) {
        const allowed = fieldsForProfile((clients.find((c: any) => c.id === row.clientId) as any)?.kpiProfile)
        for (const [f, v] of Object.entries(row.values)) if (allowed.includes(f)) (n[row.clientId] ??= {})[f] = String(v)
      }
      return n
    })
    const notes = [`${r.rows.length} clienti letti dal file: controlla e premi «Salva».`]
    if (r.unmatched.length) notes.push(`Non trovati (o non nella mail): ${r.unmatched.join(', ')}.`)
    if (r.unknownColumns.length) notes.push(`Colonne ignorate: ${r.unknownColumns.join(', ')}.`)
    if (r.errors.length) notes.push(...r.errors)
    setCsvNote(notes.join(' '))
    if (fileRef.current) fileRef.current.value = ''
  }

  if (!currentUser) return null
  if (currentUser.role === 'Cliente') return <p className="p-6 text-sm text-muted-foreground">Pagina riservata allo staff.</p>

  const columns = MANUAL_FIELDS.filter((f) => included.some((c: any) => fieldsForProfile(c.kpiProfile).includes(f.id)))

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 md:p-8">
      <div>
        <Link href="/admin/report-mensile" className="text-xs text-muted-foreground hover:underline">← Mail mensile KPI</Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Dati reali del mese</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Lead arrivati davvero, appuntamenti, test drive, vendite. Una cella vuota è «dato mancante» (la mail lo scrive), non zero:
          scrivi 0 se sono davvero zero. Compaiono i clienti nella mail il cui profilo prevede dati a mano.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-muted-foreground">Mese
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} disabled={changed > 0}
            className="mt-1 block h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground" />
        </label>
        <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-accent">
          Importa da CSV
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <button type="button" onClick={save} disabled={changed === 0 || saving}
          className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
          {saving && <Loader2 size={14} className="animate-spin" />} Salva{changed > 0 ? ` (${changed})` : ''}
        </button>
      </div>
      {changed > 0 && <p className="text-xs text-muted-foreground">Hai modifiche non salvate: per cambiare mese salva o ricarica la pagina.</p>}
      {csvNote && <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs">{csvNote}</p>}
      <p className="text-[11px] text-muted-foreground">
        CSV: una riga per cliente, intestazione «Cliente;Lead;Appuntamenti;Test drive;Vendite» (separatore «;», tab o «,»). Una cella vuota non cambia il valore.
      </p>

      {loading ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Carico…</p> : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                {columns.map((f) => <th key={f.id} className="px-2 py-2 text-right">{f.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {included.map((c: any) => {
                const allowed = fieldsForProfile(c.kpiProfile)
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-3 py-1.5"><span className="font-medium">{c.name}</span> <span className="text-[11px] text-muted-foreground">{PROFILE_DEFS[c.kpiProfile as keyof typeof PROFILE_DEFS]?.label}</span></td>
                    {columns.map((f) => (
                      <td key={f.id} className="px-2 py-1.5 text-right">
                        {allowed.includes(f.id)
                          ? <input inputMode="numeric" aria-label={`${f.label} di ${c.name}`} className={inputCls} value={cell(c.id, f.id)} onChange={(e) => setCell(c.id, f.id, e.target.value)} />
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                    ))}
                  </tr>
                )
              })}
              {included.length === 0 && <tr><td colSpan={columns.length + 1} className="px-3 py-6 text-center text-muted-foreground">Nessun cliente nella mail con dati da inserire a mano.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
