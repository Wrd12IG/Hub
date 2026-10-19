"use client"

import React, { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { adLibraryLinks, domainOf } from '@/lib/ad-library-links'

interface Competitor { id: string; nome: string; sito: string }

const LIBRARIES = [
  { key: 'meta', label: 'Meta' },
  { key: 'google', label: 'Google' },
  { key: 'linkedin', label: 'LinkedIn' },
] as const

/**
 * Per ogni competitor, le tre librerie pubbliche degli annunci già filtrate: Meta, Google e LinkedIn.
 * Le librerie non hanno un'API aperta a tutti, quindi qui si apre la ricerca pronta; i dati restano quelli ufficiali.
 */
export function CompetitorAdLibrary({ clientId }: { clientId: string }) {
  const [competitors, setCompetitors] = useState<Competitor[] | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`/api/clients/${clientId}/competitors`, { headers: { Authorization: `Bearer ${token}` } })
        const j = res.ok ? await res.json() : {}
        if (!cancelled) setCompetitors(j.competitors ?? [])
      } catch {
        if (!cancelled) setCompetitors([])
      }
    })()
    return () => { cancelled = true }
  }, [clientId])

  if (competitors === null) return <Skeleton className="h-32" />

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-bold">Annunci dei competitor</h4>
        <p className="text-xs text-muted-foreground">
          Gli annunci attivi di ciascun competitor nelle librerie pubbliche di Meta, Google e LinkedIn.
        </p>
      </div>
      {competitors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">
          Nessun competitor configurato. Aggiungili in <strong className="text-foreground">Setup API → Competitor</strong>.
        </div>
      ) : (
        <ul className="divide-y divide-white/5 rounded-xl border border-white/5 bg-white/[0.02]">
          {competitors.map((c) => {
            const links = adLibraryLinks({ nome: c.nome, sito: c.sito })
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{c.nome || domainOf(c.sito)}</p>
                  {domainOf(c.sito) && <p className="truncate text-xs text-muted-foreground">{domainOf(c.sito)}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {LIBRARIES.map((l) => (
                    <a
                      key={l.key}
                      href={links[l.key]}
                      target="_blank"
                      rel="noopener noreferrer"
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
