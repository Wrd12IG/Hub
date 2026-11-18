"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Loader2, Play, Search, X } from 'lucide-react'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { DISCOVER_HARD_CAP, ESTIMATE_VALID_MS, MAX_CITIES } from '@/lib/outreach'
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
const SHOWN = 300
const input = 'h-8 rounded-lg border border-border bg-background px-3 text-sm'

type Comune = { nome: string; label: string }
type Prov = { nome: string; sigla: string; capoluogo: string; comuni: Comune[] }

type Props = {
  meta: Meta | null
  actions: ActionRecord[]
  busy: string | null
  estimate: (provider: string, cities: string[]) => void
  run: (estimateId: string) => void
}

export function ActionsTab({ meta, actions, busy, estimate, run }: Props) {
  const discover = meta?.discover ?? null
  const { authFetch } = useAuthFetch()
  const [provider, setProvider] = useState('serper')
  const [cities, setCities] = useState<string[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [region, setRegion] = useState('')
  const [province, setProvince] = useState('')
  const [q, setQ] = useState('')
  const [geo, setGeo] = useState<Record<string, Prov[]>>({})
  const [geoError, setGeoError] = useState('')
  const pending = actions.some((a) => a.status === 'pending' && a.action !== 'signals_set')

  // L'elenco ISTAT arriva dal server una regione alla volta: 7.900 comuni insieme non servono al browser.
  const available = !!discover && discover.cap > 0 && discover.providers.length > 0
  const cap = Math.min(discover?.cap ?? 0, DISCOVER_HARD_CAP)
  useEffect(() => {
    if (!available || regions.length > 0) return
    authFetch('/api/outreach/places').then((r) => r.json()).then((d) => setRegions(d.regions ?? [])).catch(() => setGeoError('Non riesco a caricare l\'elenco delle regioni.'))
  }, [available, regions.length, authFetch])
  useEffect(() => {
    if (!region || geo[region]) return
    authFetch(`/api/outreach/places?region=${encodeURIComponent(region)}`)
      .then((r) => r.json())
      .then((d) => (d.provinces ? setGeo((g) => ({ ...g, [region]: d.provinces })) : setGeoError(d.error || 'Regione non trovata.')))
      .catch(() => setGeoError('Non riesco a caricare i comuni.'))
  }, [region, geo, authFetch])

  const provinces = useMemo(() => geo[region] ?? [], [geo, region])
  const comuni = useMemo(() => {
    const t = q.trim().toLowerCase()
    return provinces
      .filter((p) => !province || p.sigla === province)
      .flatMap((p) => p.comuni.map((c) => ({ ...c, sigla: p.sigla, capoluogo: p.capoluogo === c.nome })))
      .filter((c) => !t || c.nome.toLowerCase().includes(t))
      .sort((a, b) => Number(b.capoluogo) - Number(a.capoluogo) || a.nome.localeCompare(b.nome))
  }, [provinces, province, q])

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

  const toggle = (c: string) => setCities((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : cur.length >= MAX_CITIES ? cur : [...cur, c]))
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

        <div className="space-y-3">
          <div className="text-sm font-medium">
            Dove {cities.length === 0 && <span className="font-normal text-muted-foreground">(nessuna scelta: Sellbird usa le città del suo profilo)</span>}
            {cities.length > 0 && <span className="font-normal text-muted-foreground"> ({cities.length} di {MAX_CITIES})</span>}
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Regione, provincia e comune (elenco ISTAT)</div>
            <div className="flex flex-wrap gap-2">
              <select className={input} value={region} onChange={(e) => { setRegion(e.target.value); setProvince(''); setQ('') }} aria-label="Regione">
                <option value="">Scegli una regione</option>
                {regions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {region && (
                <select className={input} value={province} onChange={(e) => setProvince(e.target.value)} aria-label="Provincia">
                  <option value="">Tutte le province</option>
                  {provinces.map((p) => <option key={p.sigla} value={p.sigla}>{p.nome} ({p.sigla})</option>)}
                </select>
              )}
              {region && <input className={`${input} w-48`} placeholder="Cerca un comune" value={q} onChange={(e) => setQ(e.target.value)} />}
            </div>
            {geoError && <p className="text-xs text-red-600 dark:text-red-400">{geoError}</p>}

            {region && (
              <div className="space-y-2">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" checked={cities.includes(region)} disabled={provider === 'osm' || (!cities.includes(region) && cities.length >= MAX_CITIES)} onChange={() => toggle(region)} />
                  Tutta la regione ({region})
                  {provider === 'osm' && <span className="text-xs text-muted-foreground">: OpenStreetMap cerca attorno a un punto, scegli i comuni</span>}
                </label>
                <div className="max-h-56 overflow-auto rounded-lg border border-border">
                  {!geo[region] && <div className="p-3 text-sm text-muted-foreground">Carico i comuni…</div>}
                  {comuni.slice(0, SHOWN).map((c) => (
                    <label key={c.label} className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 text-sm last:border-b-0 hover:bg-accent">
                      <input type="checkbox" checked={cities.includes(c.label)} disabled={!cities.includes(c.label) && cities.length >= MAX_CITIES} onChange={() => toggle(c.label)} />
                      <span>{c.nome}</span>
                      <span className="text-xs text-muted-foreground">{c.sigla}{c.capoluogo ? ' · capoluogo' : ''}</span>
                    </label>
                  ))}
                  {geo[region] && comuni.length === 0 && <div className="p-3 text-sm text-muted-foreground">Nessun comune con questo nome.</div>}
                </div>
                {comuni.length > SHOWN && <p className="text-xs text-muted-foreground">Mostrati i primi {SHOWN} di {comuni.length}: scegli una provincia o cerca per nome.</p>}
              </div>
            )}
          </div>

          {cities.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {cities.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">
                  {c}
                  <button aria-label={`Togli ${c}`} onClick={() => toggle(c)}><X className="h-3 w-3" /></button>
                </span>
              ))}
              <button className="text-xs underline underline-offset-2" onClick={() => setCities([])}>Svuota</button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Più luoghi vuol dire più ricerche e più costo: la stima te lo dice prima, e il tetto resta {usd(cap)}.</p>
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
