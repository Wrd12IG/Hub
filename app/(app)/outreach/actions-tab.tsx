"use client"

import React, { useMemo, useState } from 'react'
import { Loader2, Play, Search } from 'lucide-react'
import { DISCOVER_HARD_CAP, ESTIMATE_VALID_MS } from '@/lib/outreach'
import { btn, fmt, type ActionRecord, type Meta } from './shared'

const PROVIDER_LABEL: Record<string, string> = {
  osm: 'OpenStreetMap (gratis, copertura scarsa per i concessionari)',
  serper: 'Serper (a pagamento)',
}
const ACTION_LABEL: Record<string, string> = { discover_estimate: 'Stima del costo', discover_run: 'Ricerca', signals_set: 'Segnali' }
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: 'In attesa di Sellbird', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  applied: { label: 'Fatto', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  failed: { label: 'Non riuscito', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
}
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))
const usd = (n: number) => `${n.toFixed(2)} $`

type Props = {
  meta: Meta | null
  actions: ActionRecord[]
  busy: string | null
  estimate: (provider: string, cities: string[]) => void
  run: (estimateId: string) => void
}

export function ActionsTab({ meta, actions, busy, estimate, run }: Props) {
  const discover = meta?.discover ?? null
  const [provider, setProvider] = useState('serper')
  const [cities, setCities] = useState<string[]>([])
  const pending = actions.some((a) => a.status === 'pending' && a.action !== 'signals_set')

  // La stima valida per questa scelta: applicata, mai usata, di meno di mezz'ora fa, per lo stesso provider e le stesse città.
  const usable = useMemo(
    () =>
      actions.find(
        (a) =>
          a.action === 'discover_estimate' && a.status === 'applied' && !a.used && a.estimatedCost !== null && a.provider === provider &&
          sameSet(a.cities, cities) && a.requestedAt && Date.now() - new Date(a.requestedAt).getTime() < ESTIMATE_VALID_MS,
      ),
    [actions, provider, cities],
  )

  if (!discover) {
    return <p className="text-sm text-muted-foreground">Il ponte sul server di Sellbird non ha ancora dichiarato cosa si può cercare: aggiornalo all&apos;ultima versione.</p>
  }
  if (discover.cap <= 0 || discover.providers.length === 0) {
    return <p className="text-sm text-muted-foreground">La ricerca di aziende dalla hub è spenta sul server (OUTREACH_MAX_DISCOVER_SPEND a 0). Resta disponibile da Sellbird.</p>
  }

  const toggle = (c: string) => setCities((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))
  const cap = Math.min(discover.cap, DISCOVER_HARD_CAP)
  const maxSpend = usable ? Math.min(cap, Math.max(0.05, Math.round((usable.estimatedCost as number) * 1.25 * 100) / 100)) : 0

  const doRun = () => {
    if (!usable) return
    const where = cities.length ? cities.join(', ') : 'tutte le città del profilo'
    if (window.confirm(`Cercare nuove aziende (${PROVIDER_LABEL[provider] ?? provider}) in: ${where}?\n\nStima ${usd(usable.estimatedCost as number)}. Sellbird si ferma comunque a ${usd(maxSpend)}.`)) run(usable.id)
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <h2 className="text-lg font-medium">Trova nuove aziende</h2>
          <p className="text-sm text-muted-foreground">
            Si fa in due passi: prima una stima del costo, che è gratuita, poi la ricerca. Sellbird non spende oltre {usd(cap)} per ricerca, qualunque cosa chieda la pagina.
          </p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="provider">Dove cercare</label>
          <select id="provider" className="h-8 rounded-lg border border-border bg-background px-3 text-sm" value={provider} onChange={(e) => setProvider(e.target.value)}>
            {discover.providers.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p] ?? p}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Città {cities.length === 0 && <span className="font-normal text-muted-foreground">(nessuna scelta: tutte quelle del profilo)</span>}</div>
          <div className="flex flex-wrap gap-2">
            {discover.cities.map((c) => (
              <label key={c} className="flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-sm">
                <input type="checkbox" checked={cities.includes(c)} onChange={() => toggle(c)} /> {c}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className={btn} disabled={pending || busy === 'estimate'} onClick={() => estimate(provider, cities)}>
            {busy === 'estimate' || pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Stima il costo
          </button>
          <button className={btn} disabled={!usable || pending || busy === 'run'} onClick={doRun}>
            <Play className="h-4 w-4" /> Esegui la ricerca{usable ? ` (stima ${usd(usable.estimatedCost as number)})` : ''}
          </button>
        </div>
        {usable && <p className="text-xs text-muted-foreground">Stima fatta alle {fmt(usable.requestedAt)}: vale mezz&apos;ora e una sola ricerca.</p>}
        {!usable && <p className="text-xs text-muted-foreground">«Esegui» si attiva dopo una stima riuscita per la stessa scelta di provider e città.</p>}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Ultime richieste</h2>
        {actions.length === 0 && <p className="text-sm text-muted-foreground">Nessuna ancora.</p>}
        {actions.map((a) => {
          const st = STATUS_LABEL[a.status] ?? STATUS_LABEL.failed
          return (
            <div key={a.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium">
                  {ACTION_LABEL[a.action]}
                  {a.action !== 'signals_set' && ` · ${a.provider ?? ''}${a.cities.length ? ` · ${a.cities.join(', ')}` : ''}`}
                  {a.action === 'signals_set' && ` · ${a.signalStatus === 'confirmed' ? 'attiva' : 'escludi'} ${a.codes.join(', ')}`}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {fmt(a.requestedAt)}
                {a.estimatedCost !== null && ` · stima ${usd(a.estimatedCost)}`}
                {a.maxSpend !== null && ` · tetto ${usd(a.maxSpend)}`}
              </div>
              {a.error && <div className="mt-1 text-xs text-red-600 dark:text-red-400">{a.error}</div>}
              {a.result && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 font-mono text-xs">{a.result}</pre>}
            </div>
          )
        })}
      </section>
    </div>
  )
}
