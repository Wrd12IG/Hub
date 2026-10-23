"use client"

import { useMemo, useState } from 'react'
import { format, addDays } from 'date-fns'
import { toast } from 'sonner'
import { AlertTriangle, CalendarPlus, Check, Copy, Info, Loader2 } from 'lucide-react'
import { addEditorialContent } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CreativeChannel, CreativeItem, CreativeKind } from '@/lib/creative/spec'
import { buildPedDraft, pedCopy } from '@/lib/creative/to-ped'

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  )
}

export function ResultCard({ item, kind, channel, topic, clientId, onSaved, openPlan }: {
  item: CreativeItem; kind: CreativeKind; channel: CreativeChannel; topic: string; clientId: string
  onSaved: () => Promise<void>; openPlan: () => void
}) {
  const [caption, setCaption] = useState(item.caption)
  const [date, setDate] = useState(format(addDays(new Date(), 2), 'yyyy-MM-dd'))
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Il testo si può ritoccare prima di salvarlo o copiarlo
  const current = useMemo<CreativeItem>(() => ({ ...item, caption }), [item, caption])
  const full = useMemo(() => {
    const body = pedCopy(kind, current)
    return item.hashtags.length > 0 ? `${body}\n\n${item.hashtags.join(' ')}` : body
  }, [kind, current, item.hashtags])

  const copy = async () => {
    try { await navigator.clipboard.writeText(full); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch { toast.error('Non riesco a copiare: seleziona il testo a mano.') }
  }

  const save = async () => {
    setSaving(true)
    try {
      await addEditorialContent(buildPedDraft({ clientId, kind, channel, item: current, topic, publicationDate: date }))
      setSaved(true)
      await onSaved()
      toast.success('Salvato nel PED come bozza.', { action: { label: 'Apri il piano', onClick: openPlan } })
    } catch (e) {
      console.error('[creative] salvataggio nel PED', e)
      toast.error('Non sono riuscito a salvarlo nel PED.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-2">
        {item.formula && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-extrabold text-amber-600">{item.formula}</span>}
        <span className="text-sm font-semibold">{item.formulaName || 'Proposta'}</span>
      </div>

      {kind === 'hooks' ? (
        <div className="space-y-3">
          <Block label="Parlato (primi 1-3 secondi)"><p className="rounded-lg border-l-4 border-amber-500 bg-muted/50 p-3 font-semibold">«{item.spoken}»</p></Block>
          <Block label="Testo a schermo"><p className="font-semibold">{item.onScreen}</p></Block>
          <Block label="Primo fotogramma"><p className="text-muted-foreground">{item.visual}</p></Block>
          <Block label="Chiusura per farlo riguardare"><p className="text-muted-foreground">{item.loopClose}</p></Block>
        </div>
      ) : (
        <div className="space-y-3">
          {item.mapping && <Block label="Cosa è diventato cosa"><p className="text-muted-foreground">{item.mapping}</p></Block>}
          {item.slides.length > 0 && (
            <Block label={`Slide (${item.slides.length})`}>
              <ol className="space-y-1.5">
                {item.slides.map((s, i) => (
                  <li key={i} className="flex gap-2 rounded-lg bg-muted/50 p-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[11px] font-bold text-amber-700">{i + 1}</span>
                    <span><span className="block text-[10px] font-bold uppercase text-muted-foreground">{s.role}</span>{s.text}</span>
                  </li>
                ))}
              </ol>
            </Block>
          )}
          <Block label={item.slides.length > 0 ? 'Didascalia' : 'Testo'}>
            <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={Math.min(14, Math.max(4, caption.split('\n').length + 1))} className="text-sm" />
            <p className="mt-1 text-[11px] text-muted-foreground">{caption.length} caratteri · puoi ritoccarlo prima di salvarlo</p>
          </Block>
          {item.hashtags.length > 0 && <Block label="Hashtag"><p className="text-sky-600">{item.hashtags.join(' ')}</p></Block>}
        </div>
      )}

      {item.warnings.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Da controllare prima di usarlo</div>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-800">{item.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
      {item.missingData.length > 0 && (
        <div className="space-y-1 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-700"><Info className="h-3.5 w-3.5" /> Con questi dati verrebbe più forte</div>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-sky-800">{item.missingData.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <Button variant="outline" size="sm" onClick={copy} className="gap-1.5">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copiato' : 'Copia'}
        </Button>
        <div className="ml-auto flex items-end gap-2">
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Data in PED</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-36 text-xs" />
          </div>
          <Button size="sm" onClick={save} disabled={saving || saved || !date} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <CalendarPlus className="h-3.5 w-3.5" />}
            {saved ? 'Salvato' : 'Salva nel PED (bozza)'}
          </Button>
        </div>
      </div>
    </article>
  )
}
