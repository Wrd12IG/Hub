"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Clapperboard, Images, Info, Loader2, Repeat2, Sparkles, Type } from 'lucide-react'
import { useLayoutData } from '@/app/(app)/layout-context'
import { authFetch } from '@/lib/client-api-auth'
import { ResultCard } from '@/components/creative/ResultCard'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CHANNEL_LABEL, GOAL_LABEL, KIND_CHANNELS, KIND_GOALS, KIND_LABEL, LIMITS,
  type CreativeChannel, type CreativeGoal, type CreativeItem, type CreativeKind,
} from '@/lib/creative/spec'
import { cn } from '@/lib/utils'

const KIND_ICON: Record<CreativeKind, typeof Type> = { hooks: Clapperboard, caption: Type, carousel: Images, repurpose: Repeat2 }
const KIND_HELP: Record<CreativeKind, string> = {
  hooks: 'I primi 3 secondi di un video verticale: parlato, testo a schermo e primo fotogramma.',
  caption: 'Il testo di un post: l\'aggancio che regge da solo, il corpo e un solo invito.',
  carousel: 'Un carosello slide per slide, con la promessa in prima e il riassunto da salvare in ultima.',
  repurpose: 'Parti da un testo che hai già (articolo, post, newsletter) e lo riadatti al canale.',
}

export default function CreativeLabPage() {
  const { id: clientId } = useParams() as { id: string }
  const { clients, currentUser, isLoadingLayout, refetchData } = useLayoutData()
  const router = useRouter()
  const client = clients.find((c) => c.id === clientId)

  const [kind, setKind] = useState<CreativeKind>('caption')
  const [channel, setChannel] = useState<CreativeChannel>('instagram')
  const [goal, setGoal] = useState<CreativeGoal>('leads')
  const [topic, setTopic] = useState('')
  const [facts, setFacts] = useState('')
  const [source, setSource] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState<CreativeItem[]>([])
  const [ran, setRan] = useState<{ kind: CreativeKind; channel: CreativeChannel; topic: string } | null>(null)

  // Cambiando tipo di lavoro, canale e obiettivo devono restare fra quelli ammessi
  useEffect(() => {
    if (!KIND_CHANNELS[kind].includes(channel)) setChannel(KIND_CHANNELS[kind][0])
    if (!KIND_GOALS[kind].includes(goal)) setGoal(KIND_GOALS[kind][0])
  }, [kind, channel, goal])

  if (isLoadingLayout || !currentUser) return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Caricamento…</div>
  if (currentUser.role === 'Cliente') return <div className="mx-auto max-w-xl p-8 text-sm text-muted-foreground">Questa pagina è riservata al team.</div>

  const isRepurpose = kind === 'repurpose'
  const canRun = !busy && (isRepurpose ? source.trim().length >= 40 : topic.trim().length >= 5)

  const run = async () => {
    setBusy(true); setError(''); setItems([])
    try {
      const res = await authFetch(`/api/clients/${clientId}/creative/generate`, {
        method: 'POST',
        body: JSON.stringify({ kind, channel, goal, topic, facts, source }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error || 'Generazione non riuscita.')
      setItems(d.items as CreativeItem[])
      setRan({ kind, channel, topic: isRepurpose ? source.slice(0, 80) : topic })
    } catch (e: any) {
      setError(e?.message || 'Generazione non riuscita.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <header className="space-y-1">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-600">
          <Sparkles className="h-3.5 w-3.5" /> Creative Lab
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Generatore creativo{client ? ` · ${client.name}` : ''}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Usa il metodo delle skill di marketing (formule di aggancio per canale, regole di lunghezza, pulizia dai segni dell&apos;AI) e i dati del cliente.
          Non inventa numeri: usa solo quelli che gli dai. Quello che salvi entra nel PED come <strong>bozza</strong>.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {(Object.keys(KIND_LABEL) as CreativeKind[]).map((k) => {
          const Icon = KIND_ICON[k]
          return (
            <button
              key={k}
              onClick={() => { setKind(k); setItems([]); setError('') }}
              className={cn(
                'flex items-center gap-2 rounded-xl border p-3 text-left text-sm font-semibold transition',
                kind === k ? 'border-amber-500 bg-amber-500/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:border-amber-500/40',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" /> {KIND_LABEL[k]}
            </button>
          )
        })}
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">{KIND_HELP[kind]}</p>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Canale</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as CreativeChannel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KIND_CHANNELS[kind].map((c) => <SelectItem key={c} value={c}>{CHANNEL_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Obiettivo principale</Label>
            <Select value={goal} onValueChange={(v) => setGoal(v as CreativeGoal)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {KIND_GOALS[kind].map((g) => <SelectItem key={g} value={g}>{GOAL_LABEL[g]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isRepurpose ? (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Testo da riutilizzare</Label>
            <Textarea value={source} onChange={(e) => setSource(e.target.value)} rows={8} maxLength={LIMITS.source} placeholder="Incolla qui il post, l'articolo o lo script di partenza…" />
            <p className="text-[11px] text-muted-foreground">{source.length}/{LIMITS.source}</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Di cosa parla</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={LIMITS.topic} placeholder="Es. Open weekend Yaris Cross, sabato 8 novembre in tutte le sedi" />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Dati veri da usare <span className="font-normal text-muted-foreground">(facoltativo, ma rende tutto più forte)</span></Label>
          <Textarea value={facts} onChange={(e) => setFacts(e.target.value)} rows={3} maxLength={LIMITS.facts} placeholder="Numeri, date, prezzi, nomi, risultati veri. Es. Rata da 199 euro al mese, anticipo zero, 4 sedi in Brianza." />
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 shrink-0" />
            Solo ciò che scrivi qui (e nell&apos;argomento) può comparire come cifra o nome. Se manca un dato utile, il risultato te lo segnala.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={run} disabled={!canRun} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? 'Sto scrivendo…' : 'Genera'}
          </Button>
          {busy && <span className="text-xs text-muted-foreground">Può richiedere fino a un minuto.</span>}
        </div>
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      </section>

      {items.length > 0 && ran && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">{items.length === 1 ? 'Proposta' : `${items.length} proposte`}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {items.map((it, i) => (
              <ResultCard
                key={i}
                item={it}
                kind={ran.kind}
                channel={ran.channel}
                topic={ran.topic}
                clientId={clientId}
                onSaved={async () => { if (refetchData) await refetchData('all') }}
                openPlan={() => router.push(`/clients/${clientId}/editorial-plan`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
