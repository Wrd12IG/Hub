"use client"

import React, { useEffect, useState } from 'react'
import { AlertCircle, ExternalLink, Users, RefreshCw, Instagram, Facebook, Linkedin } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

interface Competitor { id: string; nome: string; sito: string; instagram?: string; facebook?: string; linkedin?: string }
interface Snapshot { url: string; fetchedAt: number; via: string; title: string; description: string; offers: string[]; textLength: number }
interface Change { at: number; competitor: string; text: string; url: string }

const dataIta = (ms: number) =>
  new Date(ms).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function CompetitorsSection({ clientId }: { clientId: string }) {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>({})
  const [changes, setChanges] = useState<Change[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [lastRun, setLastRun] = useState<number | null>(null)
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

  useEffect(() => { load().finally(() => setLoading(false)) }, [clientId])

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
      await load()
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
        <div>
          <h3 className="text-base font-bold flex items-center gap-2"><Users size={16} /> Competitor</h3>
          <p className="text-xs text-muted-foreground">
            {lastRun ? `Ultima lettura ${dataIta(lastRun)}` : 'Mai letti'}
          </p>
        </div>
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
                      className="text-[11px] text-muted-foreground hover:underline inline-flex items-center gap-1">
                      {c.sito.replace(/^https?:\/\/(www\.)?/, '').slice(0, 34)} <ExternalLink size={9} />
                    </a>
                  )}
                </div>
                {/* I social restano collegamenti: non se ne estraggono numeri,
                    Instagram e LinkedIn non si lasciano leggere da un server. */}
                <div className="flex gap-1.5 shrink-0">
                  {c.instagram && <a href={c.instagram} target="_blank" rel="noopener noreferrer" title="Instagram"><Instagram size={13} className="text-muted-foreground hover:text-pink-400" /></a>}
                  {c.facebook && <a href={c.facebook} target="_blank" rel="noopener noreferrer" title="Facebook"><Facebook size={13} className="text-muted-foreground hover:text-blue-400" /></a>}
                  {c.linkedin && <a href={c.linkedin} target="_blank" rel="noopener noreferrer" title="LinkedIn"><Linkedin size={13} className="text-muted-foreground hover:text-sky-400" /></a>}
                </div>
              </div>

              {err ? (
                <p className="text-[11px] text-amber-500/90 flex items-start gap-1.5">
                  <AlertCircle size={11} className="shrink-0 mt-0.5" /> {err}
                </p>
              ) : s ? (
                <>
                  {s.offers.length > 0 ? (
                    <ul className="space-y-1">
                      {s.offers.slice(0, 3).map((o, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground leading-snug">· {o.slice(0, 90)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/60">Nessuna offerta rilevata in homepage.</p>
                  )}
                  <p className="text-[10px] text-muted-foreground/50">
                    letto {dataIta(s.fetchedAt)}{s.via === 'firecrawl' ? ' · via Firecrawl' : ''}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-muted-foreground/60">Mai letto.</p>
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
                <Badge variant="outline" className="font-normal shrink-0 text-[10px]">{dataIta(c.at)}</Badge>
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
