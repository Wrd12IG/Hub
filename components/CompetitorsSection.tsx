"use client"

import React, { useEffect, useState } from 'react'
import { decodeEntities } from '@/lib/html-entities'
import { AlertCircle, ExternalLink, Users, RefreshCw, Instagram, Facebook, Linkedin, Youtube, Music2 } from 'lucide-react'
import { normalizeSocial } from '@/lib/social-links'
import type { SocialReading } from '@/lib/competitor-social'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Competitor { id: string; nome: string; sito: string; instagram?: string; facebook?: string; linkedin?: string; youtube?: string; tiktok?: string }
interface Snapshot { url: string; fetchedAt: number; via: string; title: string; description: string; offers: string[]; textLength: number }
interface Change { at: number; competitor: string; text: string; url: string }

const nf = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' })
const dayIta = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
const NAMES = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok' } as const

const dataIta = (ms: number) =>
  new Date(ms).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function CompetitorsSection({ clientId }: { clientId: string }) {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({})
  const [changes, setChanges] = useState<Change[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [lastRun, setLastRun] = useState<number | null>(null)
  const [social, setSocial] = useState<Record<string, SocialReading>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    const token = localStorage.getItem('token')
    const res = await fetch(`/api/clients/${clientId}/competitors`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const j = await res.json()
    setCompetitors(j.competitors ?? []); setSnapshots(j.snapshots ?? {})
    setChanges(j.changes ?? []); setErrors(j.errors ?? {}); setLastRun(j.lastRun ?? null)
  }

  // Dati pubblici dei social salvati (YouTube, LinkedIn): in parallelo, senza bloccare l'elenco
  const loadSocial = async (force = false) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/clients/${clientId}/competitors/social${force ? '?refresh=1' : ''}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const j = await res.json()
      setSocial(Object.fromEntries((j.results ?? []).map((r: SocialReading) => [r.competitorId, r])))
    } catch { /* i social sono un extra: se non rispondono, restano le icone */ }
  }

  useEffect(() => { load().finally(() => setLoading(false)); loadSocial() }, [clientId])

  const refresh = async () => {
    setRefreshing(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/clients/${clientId}/competitors`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token}` },
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j?.error || 'Lettura non riuscita.')
      toast.success(j.changes?.length ? `${j.changes.length} cambiamenti rilevati` : 'Nessun cambiamento dall\'ultima lettura')
      await Promise.all([load(), loadSocial(true)])
    } catch (e: any) { toast.error(e.message) }
    finally { setRefreshing(false) }
  }

  if (loading) return <Skeleton className="h-48" />

  if (competitors.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
        Nessun competitor configurato. Aggiungili in <strong className="text-foreground">Setup API → Competitor</strong>:
        il Hub leggerà i loro siti ogni notte e segnalerà cosa cambia.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {lastRun ? `Ultima lettura ${dataIta(lastRun)}` : 'Mai letti'}
        </p>
        <button onClick={refresh} disabled={refreshing}
          className="inline-flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg border border-white/10 hover:bg-white/[0.06] transition-all disabled:opacity-40 cursor-pointer">
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Leggi ora
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {competitors.map((c) => {
          const s = snapshots[c.id]
          const err = errors[c.id]
          return (
            <div key={c.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{c.nome || c.sito}</p>
                  {c.sito && (
                    <a href={c.sito} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1">
                      {c.sito.replace(/^https?:\/\/(www\.)?/, '').slice(0, 34)} <ExternalLink size={9} />
                    </a>
                  )}
                </div>
                {/* I social restano collegamenti: non se ne estraggono numeri,
                    I social non si lasciano leggere da un server. */}
                <div className="flex gap-2 shrink-0">
                  {([
                    ['instagram', 'Instagram', Instagram, 'hover:text-pink-400'],
                    ['facebook', 'Facebook', Facebook, 'hover:text-blue-400'],
                    ['linkedin', 'LinkedIn', Linkedin, 'hover:text-sky-400'],
                    ['youtube', 'YouTube', Youtube, 'hover:text-red-500'],
                    ['tiktok', 'TikTok', Music2, 'hover:text-foreground'],
                  ] as const).map(([key, label, Icon, hover]) => {
                    // Anche le voci salvate prima, scritte come "@nome", diventano un indirizzo valido (o niente)
                    const href = normalizeSocial(key, c[key])
                    return href ? (
                      <a key={key} href={href} target="_blank" rel="noopener noreferrer" title={label} aria-label={`${label} di ${c.nome}`}>
                        <Icon size={13} className={`text-muted-foreground ${hover}`} />
                      </a>
                    ) : null
                  })}
                </div>
              </div>

              {(() => {
                const r = social[c.id]
                if (!r) return null
                const yt = r.youtube
                const li = r.linkedin
                return (
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    {yt && ('error' in yt
                      ? <p className="text-amber-600/80 dark:text-amber-500/80">YouTube: {yt.error}</p>
                      : <p>
                          <span className="font-semibold text-foreground">YouTube</span>
                          {yt.subscribers !== null && <> · {nf.format(yt.subscribers)} iscritti</>}
                          {' '}· {nf.format(yt.videos)} video · {nf.format(yt.views)} visualizzazioni
                          {yt.lastUpload && <> · ultimo video il {dayIta(yt.lastUpload)}</>}
                          {yt.lastUpload && <> · {yt.uploadsCapped ? `almeno ${yt.uploadsLast30d}` : yt.uploadsLast30d} negli ultimi 30 giorni</>}
                        </p>)}
                    {li && ('error' in li
                      ? <p className="text-amber-600/80 dark:text-amber-500/80">LinkedIn: {li.error}</p>
                      : <p><span className="font-semibold text-foreground">LinkedIn</span> · {nf.format(li.followers)} follower</p>)}
                    {r.unreadable.length > 0 && (
                      <p className="text-muted-foreground/60">
                        {r.unreadable.map((k) => NAMES[k]).join(', ')}: nessun dato pubblico leggibile da qui (chiedono l&apos;accesso). Apri il profilo dall&apos;icona.
                      </p>
                    )}
                  </div>
                )
              })()}

              {err ? (
                <p className="text-xs text-amber-500/90 flex items-start gap-1.5">
                  <AlertCircle size={11} className="shrink-0 mt-0.5" /> {err}
                </p>
              ) : s ? (
                <>
                  {s.offers.length > 0 ? (
                    <ul className="space-y-1">
                      {s.offers.slice(0, 3).map((o, i) => (
                        <li key={i} className="text-xs text-muted-foreground leading-snug">· {decodeEntities(o).slice(0, 90)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground/60">Nessuna offerta rilevata in homepage.</p>
                  )}
                  <p className="text-xs text-muted-foreground/50">
                    letto {dataIta(s.fetchedAt)}{s.via === 'firecrawl' ? ' · via Firecrawl' : ''}
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground/60">Mai letto.</p>
              )}
            </div>
          )
        })}
      </div>

      {changes.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cosa è cambiato</h4>
          <div className="space-y-1.5">
            {changes.slice(0, 8).map((c, i) => (
              <div key={i} className="flex items-start gap-3 text-xs rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
                <Badge variant="outline" className="font-normal shrink-0 text-xs">{dataIta(c.at)}</Badge>
                <span className="flex-1">
                  <strong className="text-foreground">{c.competitor}</strong> — {c.text}
                </span>
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground">
                  <ExternalLink size={11} />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
