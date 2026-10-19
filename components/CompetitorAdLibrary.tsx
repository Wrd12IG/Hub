"use client"

import React, { useEffect, useState } from 'react'
import { AlertCircle, ExternalLink, RefreshCw } from 'lucide-react'
import type { AdvertiserResult } from '@/lib/google-ads-transparency'
import { Skeleton } from '@/components/ui/skeleton'
import { adLibraryLinks, domainOf } from '@/lib/ad-library-links'

interface Competitor { id: string; nome: string; sito: string; facebook?: string; linkedin?: string }

const LIBRARIES = [
  { key: 'meta', label: 'Meta' },
  { key: 'google', label: 'Google' },
  { key: 'linkedin', label: 'LinkedIn' },
] as const

/**
 * Per ogni competitor, le tre librerie pubbliche degli annunci già filtrate: Meta, Google e LinkedIn.
 * Le librerie non hanno un'API aperta a tutti, quindi qui si apre la ricerca pronta; i dati restano quelli ufficiali.
 */
const dataIta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export function CompetitorAdLibrary({ clientId }: { clientId: string }) {
  const [competitors, setCompetitors] = useState<Competitor[] | null>(null)
  const [google, setGoogle] = useState<AdvertiserResult[] | null>(null)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [googleAt, setGoogleAt] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  const loadGoogle = async (refresh = false) => {
    setGoogleLoading(true)
    setGoogleError(null)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/clients/${clientId}/competitors/ads/google${refresh ? '?refresh=1' : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `Il server ha risposto ${res.status}.`)
      setGoogle(j.results ?? [])
      setGoogleAt(j.computedAt ?? null)
    } catch (e: any) {
      setGoogleError(e.message)
    } finally {
      setGoogleLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`/api/clients/${clientId}/competitors`, { headers: { Authorization: `Bearer ${token}` } })
        const j = res.ok ? await res.json() : {}
        if (!cancelled) {
          setCompetitors(j.competitors ?? [])
          if ((j.competitors ?? []).length > 0) loadGoogle()
        }
      } catch {
        if (!cancelled) setCompetitors([])
      }
    })()
    return () => { cancelled = true }
  }, [clientId])

  if (competitors === null) return <Skeleton className="h-32" />

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold">Annunci dei competitor</h4>
          <p className="text-xs text-muted-foreground">
            Annunci Google in Italia letti dal Centro per la trasparenza pubblicitaria{googleAt ? `, aggiornati al ${dataIta(googleAt)}` : ''}.
            Per Meta e LinkedIn si apre la libreria già filtrata.
          </p>
        </div>
        {competitors.length > 0 && (
          <button
            onClick={() => loadGoogle(true)}
            disabled={googleLoading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/[0.06] transition-colors disabled:opacity-40 cursor-pointer"
          >
            <RefreshCw size={12} className={googleLoading ? 'animate-spin' : ''} /> Aggiorna Google
          </button>
        )}
      </div>
      {googleError && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-500">
          <AlertCircle size={13} className="mt-0.5 shrink-0" /> {googleError}
        </p>
      )}
      {competitors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
          Nessun competitor configurato. Aggiungili in <strong className="text-foreground">Setup API → Competitor</strong>.
        </div>
      ) : (
        <ul className="divide-y divide-white/5 rounded-xl border border-white/5 bg-white/[0.02]">
          {competitors.map((c) => {
            const links = adLibraryLinks({ nome: c.nome, sito: c.sito, facebook: c.facebook, linkedin: c.linkedin })
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-bold">{c.nome || domainOf(c.sito)}</p>
                  {domainOf(c.sito) && <p className="truncate text-xs text-muted-foreground">{domainOf(c.sito)}</p>}
                  {googleLoading && !google && <p className="text-xs text-muted-foreground animate-pulse">Cerco gli annunci Google…</p>}
                  {google && (() => {
                    const mine = google.filter((r) => r.competitorId === c.id)
                    if (mine.length === 0) {
                      return <p className="text-xs text-muted-foreground/70">Google: nessun annuncio trovato per un inserzionista italiano con questo nome.</p>
                    }
                    return mine.slice(0, 3).map((r) => (
                      <p key={r.advertiserId} className="text-xs text-muted-foreground">
                        Google · <strong className="text-foreground">{r.advertiser}</strong>: {r.creatives} annunci in Italia
                        ({r.recent} negli ultimi 30 giorni) · testo {r.formats.text}, immagine {r.formats.image}, video {r.formats.video}
                        · ultimo visto il {dataIta(r.lastShown)}
                      </p>
                    ))
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  {LIBRARIES.map((l) => (
                    <a
                      key={l.key}
                      href={links[l.key]}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Ricerca per ${links.basis[l.key]}${links.basis[l.key] === 'nome' ? ': aggiungi la pagina del competitor per un risultato più preciso' : ''}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/[0.06] transition-colors"
                    >
                      {l.label} <ExternalLink size={11} />
                    </a>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
