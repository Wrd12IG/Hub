"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Pause, Play, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { btn, type Overview } from './shared'
import { OutboxTab } from './outbox-tab'
import { RepliesTab } from './replies-tab'
import { PipelineTab } from './pipeline-tab'
import { ContactsTab } from './contacts-tab'
import { CampaignsTab } from './campaigns-tab'
import { SignalsTab } from './signals-tab'
import { ActionsTab } from './actions-tab'

/** Il ponte sincronizza ogni pochi minuti: oltre questa soglia vuol dire che Sellbird o il ponte sono fermi. */
const STALE_MINUTES = 30

export default function OutreachPage() {
  const { currentUser } = useLayoutData()
  const { authFetch } = useAuthFetch()
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [tab, setTab] = useState('email')
  const [openId, setOpenId] = useState<string | null>(null)
  const isAdmin = currentUser?.role === 'Amministratore'

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await authFetch('/api/outreach/overview')
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Errore ${res.status}`)
      setData(await res.json())
    } catch (e: any) {
      toast.error(e.message || 'Impossibile caricare Outreach')
    } finally {
      setLoading(false)
    }
  }, [authFetch])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  // Finché c'è qualcosa in attesa di Sellbird (un'approvazione, una stima, una ricerca) la pagina si aggiorna da sola.
  const hasPending = (data?.pending.length ?? 0) > 0
  useEffect(() => {
    if (!isAdmin || !hasPending) return
    const t = setInterval(() => load(true), 10_000)
    return () => clearInterval(t)
  }, [isAdmin, hasPending, load])

  const send = async (url: string, body: object, busyKey: string, ok: string) => {
    setBusy(busyKey)
    try {
      const res = await authFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Errore ${res.status}`)
      toast.success(ok)
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setBusy(null)
    }
  }

  const decide = (id: string, action: 'approve' | 'reject') =>
    send(`/api/outreach/outbox/${id}`, { action }, id,
      action === 'approve' ? 'Approvazione registrata: Sellbird la applica entro pochi minuti.' : 'Rifiuto registrato: Sellbird lo applica entro pochi minuti.')

  const act = (body: object, busyKey: string, ok: string) => send('/api/outreach/actions', body, busyKey, ok)
  const estimate = (provider: string, cities: string[], industries: string[]) =>
    act({ action: 'discover_estimate', provider, cities, industries }, 'estimate', 'Stima richiesta: Sellbird la calcola entro un paio di minuti.')
  const runDiscover = (estimateId: string) =>
    act({ action: 'discover_run', estimateId }, 'run', 'Ricerca registrata: Sellbird la avvia entro un paio di minuti e può durare diversi minuti.')
  const setSignal = (code: string, status: 'confirmed' | 'rejected') =>
    act({ action: 'signals_set', codes: [code], status }, 'signals', status === 'confirmed' ? 'Segnale da attivare: Sellbird lo applica entro un paio di minuti.' : 'Segnale da escludere: Sellbird lo applica entro un paio di minuti.')

  const exclude = (domain: string, add: boolean) => {
    const msg = add
      ? `Escludere ${domain}?\n\nSellbird non scriverà più a questa azienda, nemmeno con le email già approvate, e le sue bozze in coda verranno rifiutate. Si può annullare con «Riammetti», ma le bozze rifiutate non tornano.`
      : `Riammettere ${domain}?\n\nSellbird potrà di nuovo scrivere a questa azienda. Le bozze già rifiutate non tornano: andranno riscritte.`
    if (!window.confirm(msg)) return
    send('/api/outreach/exclusions', { action: add ? 'add' : 'remove', domain }, 'exclusion',
      add ? 'Esclusione registrata: Sellbird la applica entro pochi minuti.' : 'Riammissione registrata: Sellbird la applica entro pochi minuti.')
  }

  const paused = data?.meta?.sendingPaused ?? null
  const sendingCommand = useMemo(() => data?.pending.find((p) => p.action === 'pause_sending' || p.action === 'resume_sending'), [data])

  const toggleSending = () => {
    const stop = paused === null
    const msg = stop
      ? 'Fermare tutti gli invii di Sellbird? Le email approvate restano in coda e non partono finché non riprendi.'
      : 'Riprendere gli invii? Sellbird invierà le email già approvate, nei suoi orari e nei suoi limiti giornalieri.'
    if (!window.confirm(msg)) return
    send('/api/outreach/sending', { action: stop ? 'pause' : 'resume' }, 'sending',
      stop ? 'Pausa registrata: Sellbird la applica entro pochi minuti.' : 'Ripresa registrata: Sellbird la applica entro pochi minuti.')
  }

  if (!currentUser) return null
  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Pagina riservata agli amministratori.</p>

  const minutes = data?.meta ? Math.round((Date.now() - new Date(data.meta.syncedAt).getTime()) / 60000) : null
  const stale = minutes === null || minutes > STALE_MINUTES
  const counts = data?.meta?.outboxCounts ?? {}
  const toReview = counts['pending_review'] ?? 0
  const goToDraft = (id: string) => { setTab('email'); setOpenId(id); setTimeout(() => document.getElementById(`email-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Outreach</h1>
          <p className="text-sm text-muted-foreground">Prospezione via email con Sellbird. Nulla parte senza la tua approvazione.</p>
        </div>
        <div className="flex gap-2">
          {data?.meta && (
            <button className={btn} onClick={toggleSending} disabled={busy === 'sending' || !!sendingCommand}>
              {paused === null ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {sendingCommand ? 'In attesa di Sellbird' : paused === null ? 'Ferma gli invii' : 'Riprendi gli invii'}
            </button>
          )}
          <button className={btn} onClick={() => load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Aggiorna
          </button>
        </div>
      </div>

      {stale && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          {minutes === null
            ? 'Sellbird non ha mai sincronizzato. Controlla che il ponte sia acceso sul server di Sellbird.'
            : `Ultima sincronizzazione ${minutes} minuti fa: Sellbird o il ponte potrebbero essere fermi. Le decisioni restano in coda finché non riparte.`}
        </div>
      )}
      {paused !== null && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm">
          Gli invii sono <strong>in pausa</strong> ({paused}). Le email approvate non partono finché non riprendi.
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="email">Email{toReview > 0 ? ` (${toReview})` : ''}</TabsTrigger>
          <TabsTrigger value="risposte">Risposte{data?.replies.length ? ` (${data.replies.length})` : ''}</TabsTrigger>
          <TabsTrigger value="contatti">Contatti{data?.contacts.length ? ` (${data.contacts.length})` : ''}</TabsTrigger>
          <TabsTrigger value="campagne">Campagne</TabsTrigger>
          <TabsTrigger value="segnali">Segnali</TabsTrigger>
          <TabsTrigger value="trova">Trova aziende</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline e uso</TabsTrigger>
        </TabsList>
        <TabsContent value="email" className="mt-4">
          <OutboxTab outbox={data?.outbox ?? []} companies={data?.companies ?? []} pending={data?.pending ?? []} busy={busy} decide={decide} openId={openId} setOpenId={setOpenId}
            exclude={exclude} exclusionBusy={busy === 'exclusion' || (data?.pending.some((p) => p.action === 'dnc_add' || p.action === 'dnc_remove') ?? false)} />
        </TabsContent>
        <TabsContent value="risposte" className="mt-4">
          <RepliesTab replies={data?.replies ?? []} outbox={data?.outbox ?? []} goToDraft={goToDraft} />
        </TabsContent>
        <TabsContent value="contatti" className="mt-4">
          <ContactsTab contacts={data?.contacts ?? []} />
        </TabsContent>
        <TabsContent value="campagne" className="mt-4">
          <CampaignsTab campaigns={data?.meta?.campaigns ?? []} />
        </TabsContent>
        <TabsContent value="segnali" className="mt-4">
          <SignalsTab signals={data?.meta?.signals ?? []} busy={busy === 'signals' || (data?.pending.some((p) => p.action === 'signals_set') ?? false)} setSignal={setSignal} />
        </TabsContent>
        <TabsContent value="trova" className="mt-4">
          <ActionsTab meta={data?.meta ?? null} actions={data?.actions ?? []} busy={busy} estimate={estimate} run={runDiscover} />
        </TabsContent>
        <TabsContent value="pipeline" className="mt-4">
          <PipelineTab stats={data?.meta?.stats ?? null} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
