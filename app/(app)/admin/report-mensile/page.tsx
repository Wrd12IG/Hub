"use client"

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { DEFAULT_SEND_DAY, splitRecipients } from '@/lib/monthly-mail-settings'
import { toast } from 'sonner'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { hasReportSources } from '@/lib/report-warm'
import {
  KPI_CATALOG, KPI_PROFILES, MAX_KPIS, PROFILE_DEFS, SOURCE_LABELS, kpiIdsFor, kpiIdsForClient, monthlyMailState, suggestionFor, isKpiProfile,
  type KpiOverrides, type KpiProfile,
} from '@/lib/kpi-profiles'

type Row = { kpiProfile?: KpiProfile | null; monthlyKpiMail?: boolean; kpiSelection?: string[] | null }

const select = 'h-9 w-full rounded-lg border border-border bg-background px-2 text-sm text-foreground'

/**
 * Mail mensile dei KPI — Fase 1: a ogni cliente si assegna un profilo (che decide quali KPI guardare) e si accende o
 * spegne il flag «Nella mail». Opt-in: un cliente nuovo non compare finché non lo accendi. Non invia nulla.
 */
export default function ReportMensilePage() {
  const { authFetch } = useAuthFetch()
  const { currentUser, clients, refetchData } = useLayoutData()
  const [overrides, setOverrides] = useState<Record<string, Row>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [bulk, setBulk] = useState(false)
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const profiles = useProfileOverrides()

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return [...clients]
      .map((c: any) => ({ c, v: { kpiProfile: c.kpiProfile ?? null, monthlyKpiMail: c.monthlyKpiMail === true, kpiSelection: c.kpiSelection ?? null, ...overrides[c.id] } as Row }))
      .filter(({ c }) => !q || String(c.name || '').toLowerCase().includes(q))
      .sort((a, b) => String(a.c.name).localeCompare(String(b.c.name), 'it', { sensitivity: 'base' }))
  }, [clients, overrides, search])

  const counts = useMemo(() => {
    const k = { included: 0, excluded: 0, no_profile: 0 }
    for (const { v } of rows) k[monthlyMailState(v)]++
    return k
  }, [rows])

  async function patch(id: string, body: Row): Promise<boolean> {
    const res = await authFetch(`/api/clients/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.error || `Errore ${res.status}`)
    }
    return true
  }

  async function save(id: string, body: Row) {
    setSaving((s) => ({ ...s, [id]: true }))
    try {
      await patch(id, body)
      setOverrides((o) => ({ ...o, [id]: { ...o[id], ...body } }))
    } catch (e: any) { toast.error(e.message || 'Impossibile salvare') }
    finally { setSaving((s) => ({ ...s, [id]: false })) }
  }

  // Solo i clienti senza profilo e senza flag: una scelta già fatta non si sovrascrive mai
  const toFill = useMemo(() => clients.flatMap((c: any) => {
    if (c.kpiProfile || c.monthlyKpiMail !== undefined || overrides[c.id]) return []
    const s = suggestionFor(c.name)
    return s ? [{ id: c.id as string, body: { kpiProfile: s.profile, monthlyKpiMail: s.include } as Row }] : []
  }), [clients, overrides])

  async function applySuggested() {
    if (!window.confirm(`Applico la proposta a ${toFill.length} clienti che non hanno ancora né profilo né flag? Le scelte già fatte non vengono toccate.`)) return
    setBulk(true)
    let ok = 0, ko = 0
    for (const { id, body } of toFill) {
      try { await patch(id, body); setOverrides((o) => ({ ...o, [id]: body })); ok++ } catch { ko++ }
    }
    setBulk(false)
    if (ko) toast.error(`${ok} salvati, ${ko} non salvati: riprova`)
    else toast.success(`Proposta applicata a ${ok} clienti`)
    await refetchData('clients')
  }

  if (currentUser?.role !== 'Amministratore') return <p className="p-6 text-sm text-muted-foreground">Pagina riservata agli amministratori.</p>

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mail mensile dei KPI</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Scegli per ogni cliente il profilo (decide quali KPI guardare) e se entra nella mail. È una sola mail con tutti i clienti.
            Un cliente nuovo non compare finché non accendi «Nella mail».
          </p>
        </div>
        <button type="button" onClick={applySuggested} disabled={bulk || toFill.length === 0}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
          {bulk && <Loader2 size={14} className="animate-spin" />}
          Applica proposta iniziale ({toFill.length})
        </button>
      </div>

      <MailSettingsCard />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <Link href="/admin/report-mensile/dati-reali" className="font-medium underline underline-offset-2">Dati reali del mese →</Link>
        <Link href="/admin/report-mensile/anteprima" className="font-medium underline underline-offset-2">Anteprima della mail →</Link>
        <span><b>{counts.included}</b> nella mail</span>
        <span><b>{counts.excluded}</b> esclusi</span>
        {counts.no_profile > 0 && <span className="text-amber-700 dark:text-amber-400"><b>{counts.no_profile}</b> con flag acceso ma senza profilo</span>}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca cliente…" aria-label="Cerca cliente"
          className="ml-auto h-9 w-56 rounded-lg border border-border bg-background px-3 text-sm" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2 w-56">Profilo</th>
              <th className="px-3 py-2 w-28 text-center">Nella mail</th>
              <th className="px-3 py-2 w-44">KPI</th>
              <th className="px-3 py-2 w-32">Dati collegati</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, v }) => {
              const state = monthlyMailState(v)
              const effective = kpiIdsForClient(v, profiles.overrides)
              return (
                <React.Fragment key={c.id}>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2">
                    <select aria-label={`Profilo di ${c.name}`} className={select} disabled={!!saving[c.id]}
                      value={v.kpiProfile ?? ''}
                      onChange={(e) => save(c.id, { kpiProfile: isKpiProfile(e.target.value) ? e.target.value : null })}>
                      <option value="">Nessun profilo</option>
                      {KPI_PROFILES.map((p) => <option key={p} value={p}>{PROFILE_DEFS[p].label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" aria-label={`${c.name} nella mail`} className="h-4 w-4 cursor-pointer"
                      checked={v.monthlyKpiMail === true} disabled={!!saving[c.id]}
                      onChange={(e) => save(c.id, { monthlyKpiMail: e.target.checked })} />
                    {state === 'no_profile' && <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">serve un profilo</p>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {effective ? (
                      <button type="button" aria-expanded={openId === c.id} onClick={() => setOpenId(openId === c.id ? null : c.id)}
                        className="text-left hover:underline">
                        {effective.length} KPI <span className="text-muted-foreground">{v.kpiSelection ? '· solo suoi' : '· del profilo'}</span>
                      </button>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {hasReportSources(c) ? 'Collegati' : <span className="text-amber-700 dark:text-amber-400">Nessuna fonte</span>}
                  </td>
                </tr>
                {openId === c.id && effective && (
                  <tr className="border-t border-border bg-muted/20">
                    <td colSpan={5} className="px-3 py-3">
                      <ClientKpiEditor name={c.name} ids={effective} personal={!!v.kpiSelection} saving={!!saving[c.id]}
                        onSave={(ids) => save(c.id, { kpiSelection: ids })}
                        onReset={() => save(c.id, { kpiSelection: null })} />
                    </td>
                  </tr>
                )}
                </React.Fragment>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Nessun cliente.</td></tr>}
          </tbody>
        </table>
      </div>

      <ProfileEditor overrides={profiles.overrides} setOverrides={profiles.setOverrides} loading={profiles.loading} />
    </div>
  )
}

/**
 * «Cosa guarda ogni profilo»: i KPI di ogni profilo si possono togliere, aggiungere (fino a 5) e riordinare. Il primo è il
 * KPI principale. «Ripristina» torna ai predefiniti. La scelta vale per TUTTI i clienti di quel profilo.
 */
function ProfileEditor({ overrides, setOverrides, loading }: { overrides: KpiOverrides; setOverrides: (o: KpiOverrides) => void; loading: boolean }) {
  const { authFetch } = useAuthFetch()
  const [draft, setDraft] = useState<Partial<Record<KpiProfile, string[]>>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const current = (p: KpiProfile) => draft[p] ?? kpiIdsFor(p, overrides)
  const dirty = (p: KpiProfile) => draft[p] !== undefined && draft[p]!.join() !== kpiIdsFor(p, overrides).join()
  const change = (p: KpiProfile, ids: string[]) => setDraft((d) => ({ ...d, [p]: ids }))

  async function send(p: KpiProfile, kpis: string[] | null) {
    setSaving(p)
    try {
      const res = await authFetch('/api/admin/kpi-profiles', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: p, kpis }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `Errore ${res.status}`)
      setOverrides(j.overrides ?? {})
      setDraft((d) => { const n = { ...d }; delete n[p]; return n })
      toast.success(kpis === null ? 'Ripristinati i KPI predefiniti' : 'KPI salvati')
    } catch (e: any) { toast.error(e.message || 'Impossibile salvare') }
    finally { setSaving(null) }
  }

  return (
    <div>
      <h2 className="mb-1 text-sm font-semibold">Cosa guarda ogni profilo</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Togli o aggiungi i KPI (da 1 a {MAX_KPIS}). Il primo è il KPI principale. La scelta vale per tutti i clienti del profilo.
      </p>
      {loading ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Carico i profili…</p> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {KPI_PROFILES.map((p) => {
            const ids = current(p)
            const isDefault = overrides[p] === undefined
            return (
              <div key={p} className="rounded-xl border border-border p-3">
                <p className="text-sm font-semibold">{PROFILE_DEFS[p].label} {!isDefault && <span className="ml-1 text-[11px] font-normal text-muted-foreground">personalizzato</span>}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{PROFILE_DEFS[p].description}</p>
                <KpiListEditor ids={ids} label={PROFILE_DEFS[p].label} onChange={(n) => change(p, n)} />
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" disabled={!dirty(p) || saving === p} onClick={() => send(p, ids)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
                    {saving === p && <Loader2 size={12} className="animate-spin" />} Salva
                  </button>
                  {dirty(p) && (
                    <button type="button" onClick={() => setDraft((d) => { const n = { ...d }; delete n[p]; return n })}
                      className="h-8 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground">Annulla</button>
                  )}
                  {!isDefault && !dirty(p) && (
                    <button type="button" disabled={saving === p} onClick={() => send(p, null)}
                      className="h-8 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground">Ripristina predefiniti</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Carica i KPI scelti per ogni profilo (settings/kpiProfiles): servono sia all'editor dei profili sia a mostrare i KPI di ogni cliente. */
function useProfileOverrides() {
  const { authFetch } = useAuthFetch()
  const [overrides, setOverrides] = useState<KpiOverrides>({})
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let off = false
    authFetch('/api/admin/kpi-profiles')
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j?.error || `Errore ${r.status}`); return j })
      .then((j) => { if (!off) setOverrides(j.overrides ?? {}) })
      .catch((e) => toast.error(`Profili KPI: ${e.message}`))
      .finally(() => { if (!off) setLoading(false) })
    return () => { off = true }
  }, [authFetch])
  return { overrides, setOverrides, loading }
}

/** Elenco di KPI modificabile: ↑ per riordinare, ✕ per togliere, menu per aggiungere (da 1 a MAX_KPIS). Non salva: avvisa chi lo usa. */
function KpiListEditor({ ids, label, onChange }: { ids: string[]; label: string; onChange: (ids: string[]) => void }) {
  const free = Object.values(KPI_CATALOG).filter((k) => !ids.includes(k.id))
  return (
    <>
      <ol className="mt-2 space-y-1">
        {ids.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1 text-xs">
            <span className="w-4 text-muted-foreground">{i + 1}</span>
            <span className="flex-1">{KPI_CATALOG[id]?.label ?? id}<span className="ml-1.5 text-muted-foreground">{KPI_CATALOG[id] ? SOURCE_LABELS[KPI_CATALOG[id].source] : ''}</span></span>
            <button type="button" aria-label={`Sposta su ${KPI_CATALOG[id]?.label}`} disabled={i === 0}
              onClick={() => { const n = [...ids]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n) }}
              className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30">↑</button>
            <button type="button" aria-label={`Togli ${KPI_CATALOG[id]?.label}`} disabled={ids.length <= 1}
              onClick={() => onChange(ids.filter((x) => x !== id))}
              className="px-1 text-muted-foreground hover:text-red-500 disabled:opacity-30">✕</button>
          </li>
        ))}
      </ol>
      <select aria-label={`Aggiungi un KPI a ${label}`} className={`${select} mt-2`} value=""
        disabled={ids.length >= MAX_KPIS}
        onChange={(e) => { if (e.target.value) onChange([...ids, e.target.value]) }}>
        <option value="">{ids.length >= MAX_KPIS ? `Massimo ${MAX_KPIS} KPI` : 'Aggiungi un KPI…'}</option>
        {free.map((k) => <option key={k.id} value={k.id}>{k.label} — {SOURCE_LABELS[k.source]}</option>)}
      </select>
    </>
  )
}

/**
 * KPI di UN cliente. Parte da quelli attuali (del profilo o già personali): salvandoli, il cliente ha un elenco suo che
 * non segue più le modifiche al profilo. «Usa quelli del profilo» toglie l'elenco personale.
 */
function ClientKpiEditor({ name, ids, personal, saving, onSave, onReset }: {
  name: string; ids: string[]; personal: boolean; saving: boolean; onSave: (ids: string[]) => void; onReset: () => void
}) {
  const [draft, setDraft] = useState<string[] | null>(null)
  const current = draft ?? ids
  const dirty = draft !== null && draft.join() !== ids.join()
  return (
    <div className="max-w-md">
      <p className="text-xs font-semibold">KPI di {name}</p>
      <p className="text-[11px] text-muted-foreground">
        {personal ? 'Elenco solo suo: non segue più le modifiche al profilo.' : 'Oggi usa quelli del profilo. Se li cambi, questo cliente avrà un elenco suo.'}
      </p>
      <KpiListEditor ids={current} label={name} onChange={setDraft} />
      <div className="mt-2 flex items-center gap-2">
        <button type="button" disabled={!dirty || saving} onClick={() => { onSave(current); setDraft(null) }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
          {saving && <Loader2 size={12} className="animate-spin" />} Salva per {name.length > 18 ? 'questo cliente' : name}
        </button>
        {dirty && <button type="button" onClick={() => setDraft(null)} className="h-8 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground">Annulla</button>}
        {personal && !dirty && (
          <button type="button" disabled={saving} onClick={onReset} className="h-8 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground">Usa quelli del profilo</button>
        )}
      </div>
    </div>
  )
}

/**
 * Chi riceve la mail mensile e che giorno parte. È UNA mail con tutti i clienti, a indirizzi decisi qui: non va mai ai
 * clienti. L'invio automatico non è ancora attivo: oggi queste impostazioni sono solo salvate.
 */
function MailSettingsCard() {
  const { authFetch } = useAuthFetch()
  const [recipients, setRecipients] = useState('')
  const [sendDay, setSendDay] = useState(DEFAULT_SEND_DAY)
  const [saved, setSaved] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let off = false
    authFetch('/api/admin/monthly-kpi-mail-settings')
      .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j?.error || `Errore ${r.status}`); return j })
      .then((j) => {
        if (off) return
        const text = (j.settings.recipients as string[]).join('\n')
        setRecipients(text); setSendDay(j.settings.sendDay); setSaved(`${text}|${j.settings.sendDay}`)
      })
      .catch((e) => toast.error(`Impostazioni invio: ${e.message}`))
      .finally(() => { if (!off) setLoading(false) })
    return () => { off = true }
  }, [authFetch])

  const list = splitRecipients(recipients)
  const dirty = `${list.join('\n')}|${sendDay}` !== saved

  async function save() {
    setSaving(true)
    try {
      const res = await authFetch('/api/admin/monthly-kpi-mail-settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipients: list, sendDay }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `Errore ${res.status}`)
      const text = (j.settings.recipients as string[]).join('\n')
      setRecipients(text); setSendDay(j.settings.sendDay); setSaved(`${text}|${j.settings.sendDay}`)
      toast.success('Impostazioni salvate')
    } catch (e: any) { toast.error(e.message || 'Impossibile salvare') }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <h2 className="text-sm font-semibold">Invio della mail</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Una sola mail al mese con tutti i clienti, solo a questi indirizzi. L&apos;invio automatico non è ancora attivo.</p>
      {loading ? <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Carico…</p> : (
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="text-xs font-medium text-muted-foreground">Destinatari (uno per riga)
            <textarea value={recipients} onChange={(e) => setRecipients(e.target.value)} rows={3}
              className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs font-medium text-muted-foreground">Giorno del mese
            <select value={sendDay} onChange={(e) => setSendDay(Number(e.target.value))} className={`${select} mt-1 w-28`}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <span className="mt-1 block text-[11px] font-normal">alle 08:00, dal 1 al 28</span>
          </label>
        </div>
      )}
      <button type="button" onClick={save} disabled={!dirty || saving || loading || list.length === 0}
        className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
        {saving && <Loader2 size={12} className="animate-spin" />} Salva
      </button>
    </div>
  )
}
