"use client"

import { useCallback, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { addDays, format, nextMonday } from 'date-fns'
import { toast } from 'sonner'
import { AlertTriangle, CalendarPlus, CalendarRange, Info, Loader2, Sparkles } from 'lucide-react'
import { useLayoutData } from '@/app/(app)/layout-context'
import { authFetch } from '@/lib/client-api-auth'
import { addEditorialContent } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GOAL_LABEL, type CreativeGoal } from '@/lib/creative/spec'
import { LIMITS, POSTS_PER_PERIOD, type PlanPost, type SkeletonPost } from '@/lib/ped-plan/spec'
import { buildPedDraft } from '@/lib/ped-plan/to-ped'
import { PlanPostCard, type Slot } from '@/components/ped-plan/PlanPostCard'

const GOALS: CreativeGoal[] = ['leads', 'bookings', 'traffic', 'awareness', 'saves', 'shares', 'comments', 'follows']
const CONCURRENCY = 3

export default function PedPlanPage() {
  const { id: clientId } = useParams() as { id: string }
  const { clients, currentUser, isLoadingLayout, refetchData } = useLayoutData()
  const router = useRouter()
  const client = clients.find((c) => c.id === clientId)

  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [startDate, setStartDate] = useState(format(nextMonday(new Date()), 'yyyy-MM-dd'))
  const [goal, setGoal] = useState<CreativeGoal>('leads')
  const [events, setEvents] = useState('')
  const [facts, setFacts] = useState('')

  const [phase, setPhase] = useState<'form' | 'skeleton' | 'detail' | 'done'>('form')
  const [error, setError] = useState('')
  const [planWarnings, setPlanWarnings] = useState<string[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [saving, setSaving] = useState<string | null>(null)
  const run = useRef(0) // un nuovo piano annulla gli aggiornamenti di quello precedente

  const patchSlot = useCallback((id: string, patch: Partial<Slot>) => setSlots((s) => s.map((x) => (x.skeleton.id === id ? { ...x, ...patch } : x))), [])

  const writeOne = useCallback(async (sk: SkeletonPost, token: number) => {
    patchSlot(sk.id, { status: 'working', error: undefined })
    try {
      const res = await authFetch(`/api/clients/${clientId}/ped-plan`, { method: 'POST', body: JSON.stringify({ stage: 'detail', post: sk, goal, events, facts }) })
      const d = await res.json().catch(() => ({}))
      if (token !== run.current) return
      if (!res.ok) throw new Error(d.error || 'Non riuscito.')
      patchSlot(sk.id, { status: 'ready', post: d.post as PlanPost })
    } catch (e: any) {
      if (token === run.current) patchSlot(sk.id, { status: 'error', error: e?.message || 'Non riuscito.' })
    }
  }, [clientId, goal, events, facts, patchSlot])

  if (isLoadingLayout || !currentUser) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Caricamento…</div>
  if (currentUser.role === 'Cliente') return <div className="mx-auto max-w-xl p-8 text-sm text-muted-foreground">Questa pagina è riservata al team.</div>

  const create = async () => {
    const token = ++run.current
    setError(''); setPlanWarnings([]); setSlots([]); setPhase('skeleton')
    try {
      const res = await authFetch(`/api/clients/${clientId}/ped-plan`, { method: 'POST', body: JSON.stringify({ stage: 'skeleton', period, startDate, goal, events, facts }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Generazione del piano non riuscita.')
      if (token !== run.current) return
      const posts = d.posts as SkeletonPost[]
      setPlanWarnings(d.warnings || [])
      setSlots(posts.map((p) => ({ skeleton: p, status: 'waiting', included: true })))
      setPhase('detail')
      // Un contenuto alla volta per ogni «operaio», tre in parallelo: un mese intero in una sola chiamata supererebbe i 60 s
      let next = 0
      const worker = async () => { while (next < posts.length && token === run.current) { const sk = posts[next++]; await writeOne(sk, token) } }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, posts.length) }, worker))
      if (token === run.current) setPhase('done')
    } catch (e: any) {
      if (token === run.current) { setError(e?.message || 'Generazione del piano non riuscita.'); setPhase('form') }
    }
  }

  const ready = slots.filter((s) => s.status === 'ready' && s.included && s.post)
  const working = slots.filter((s) => s.status === 'waiting' || s.status === 'working').length
  const savePlan = async () => {
    setSaving(`0/${ready.length}`)
    let done = 0
    try {
      for (const s of ready) {
        const post: PlanPost = { ...s.post!, date: s.skeleton.date, time: s.skeleton.time }
        await addEditorialContent(buildPedDraft(clientId, post))
        setSaving(`${++done}/${ready.length}`)
      }
      if (refetchData) await refetchData('all')
      toast.success(`${done} ${done === 1 ? 'bozza salvata' : 'bozze salvate'} nel PED.`, { duration: 15000, action: { label: 'Apri il PED', onClick: () => router.push(`/clients/${clientId}/editorial-plan`) } })
      setSlots([]); setPhase('form')
    } catch (e) {
      console.error('[ped-plan] salvataggio', e)
      toast.error(`Salvate ${done} su ${ready.length}: non sono riuscito a salvare le altre.`)
    } finally { setSaving(null) }
  }

  const total = POSTS_PER_PERIOD[period]
  const finished = slots.length - working
  const busy = phase === 'skeleton' || phase === 'detail'

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-600"><CalendarRange className="h-3.5 w-3.5" /> Piano PED</div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Piano dei contenuti{client ? ` · ${client.name}` : ''}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Il Hub propone la settimana o il mese su Instagram con il metodo delle skill: mix di formati, un angolo preciso per ogni post, formule di aggancio, copioni, caroselli e storie, con controlli fissi su ogni contenuto.
          Quello che salvi entra nel PED come <strong>bozza</strong>.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border bg-card p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Periodo</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as 'week' | 'month')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="week">Una settimana (5 contenuti)</SelectItem><SelectItem value="month">Un mese (14 contenuti)</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Dal giorno</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} min={format(addDays(new Date(), -1), 'yyyy-MM-dd')} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Obiettivo</Label>
            <Select value={goal} onValueChange={(v) => setGoal(v as CreativeGoal)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{GOALS.map((g) => <SelectItem key={g} value={g}>{GOAL_LABEL[g]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Eventi e ricorrenze del periodo <span className="font-normal text-muted-foreground">(facoltativo)</span></Label>
          <Textarea value={events} onChange={(e) => setEvents(e.target.value)} rows={2} maxLength={LIMITS.events} placeholder="Es. Open weekend Yaris Cross sabato 8 novembre, chiusura promo il 30, ponte di Ognissanti" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Dati veri da usare <span className="font-normal text-muted-foreground">(consigliati: servono per i contenuti di tipo «prova»)</span></Label>
          <Textarea value={facts} onChange={(e) => setFacts(e.target.value)} rows={3} maxLength={LIMITS.facts} placeholder="Numeri, risultati, prezzi, cose successe davvero questa settimana. Es. 12 test drive prenotati sabato scorso, rata da 199 euro, 4 sedi in Brianza." />
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground"><Info className="mt-0.5 h-3 w-3 shrink-0" />Solo ciò che scrivi qui può comparire come cifra, nome o risultato. Senza dati veri il piano evita i contenuti «prova» e non inventa numeri.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={create} disabled={busy || !startDate} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {phase === 'skeleton' ? 'Sto pensando al piano…' : phase === 'detail' ? `Scrivo i contenuti ${finished}/${slots.length}` : `Crea il piano (${total} contenuti)`}
          </Button>
          {phase === 'detail' && <span className="text-xs text-muted-foreground">Ogni contenuto richiede 15-30 secondi: tre alla volta.</span>}
        </div>
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      </section>

      {slots.length > 0 && (
        <section className="space-y-4">
          {planWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />Sul piano nel suo insieme</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-amber-800">{planWarnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {slots.map((s) => (
              <PlanPostCard
                key={s.skeleton.id}
                slot={s}
                onChange={(post) => patchSlot(s.skeleton.id, { post })}
                onRetry={() => writeOne(s.skeleton, run.current)}
                onToggle={(v) => patchSlot(s.skeleton.id, { included: v })}
                onSkeleton={(patch) => setSlots((all) => all.map((x) => (x.skeleton.id === s.skeleton.id ? { ...x, skeleton: { ...x.skeleton, ...patch } } : x)))}
              />
            ))}
          </div>
          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card/95 p-3 shadow-lg backdrop-blur">
            <p className="text-sm text-muted-foreground">{ready.length} {ready.length === 1 ? 'contenuto pronto' : 'contenuti pronti'}{working > 0 ? ` · ${working} in lavorazione` : ''}</p>
            <Button onClick={savePlan} disabled={ready.length === 0 || working > 0 || !!saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
              {saving ? `Salvo ${saving}…` : `Salva nel PED (${ready.length} bozze)`}
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
