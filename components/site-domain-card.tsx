"use client"

import React, { useEffect, useState } from "react"
import { Globe, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CollapsibleCard } from "@/components/CollapsibleCard"
import { Ga4OverviewPanel } from "@/components/ga4-overview-panel"
import { authFetch } from "@/lib/client-api-auth"
import type { ClientSite } from "@/lib/client-sites"

export interface SiteDomainCardProps {
  clientId: string
  site: ClientSite
  isClient: boolean
  /** Periodo a mano (due date) oppure, se nullo, gli ultimi `daysBack` giorni. */
  range: { from: string; to: string } | null
  daysBack: number
  compareMode: string
  /** Il periodo a parole, per il titolo delle conversioni. */
  periodLabel: string
  /** Se la pagina ha già letto i dati di questo sito (il primo), la scheda non li richiede una seconda volta. */
  prefetched?: { data: any | null; loading: boolean }
  /** Apre «Gestisci siti» (solo staff). */
  onManage?: () => void
}

/**
 * «Performance dominio» di UN sito: la scheda che prima c'era una volta sola nella Panoramica. Un cliente può avere più
 * siti (di solito uno per marca): ognuno ha la sua scheda, con il suo Analytics.
 */
export function SiteDomainCard({ clientId, site, isClient, range, daysBack, compareMode, periodLabel, prefetched, onManage }: SiteDomainCardProps) {
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ownFetch = !prefetched && !!site.ga4PropertyId

  useEffect(() => {
    if (!ownFetch) return
    let cancelled = false
    setLoading(true); setError(null)
    const period = range ? `from=${range.from}&to=${range.to}` : `dateRange=${daysBack}d`
    authFetch(`/api/clients/${clientId}/analytics?${period}&compare=${compareMode}&site=${encodeURIComponent(site.id)}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}))
        if (!res.ok || json.notConfigured) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
        if (!cancelled) setData(json)
      })
      .catch((e) => { if (!cancelled) { setData(null); setError(e instanceof Error ? e.message : "Errore") } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [ownFetch, clientId, site.id, range?.from, range?.to, daysBack, compareMode]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = prefetched ? prefetched.data : data
  const isLoading = prefetched ? prefetched.loading : loading
  const host = site.url ? site.url.replace(/^https?:\/\//, "") : "Nessun dominio"

  return (
    <CollapsibleCard
      defaultOpen
      icon={Globe}
      title="Performance dominio"
      description={host}
      summary={site.brand ? <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-semibold text-foreground">{site.brand}</span> : undefined}
    >
      {isLoading ? (
        <div className="bg-muted/40 p-8 rounded-xl text-center flex flex-col items-center justify-center min-h-[120px] gap-2 border border-dashed border-border">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground animate-pulse">Carico i dati di Analytics…</span>
        </div>
      ) : !site.ga4PropertyId ? (
        <div className="bg-primary/5 border border-dashed border-primary/20 p-6 rounded-xl text-center space-y-3">
          <div className="text-sm font-semibold text-primary">Google Analytics non collegato</div>
          <div className="text-xs text-muted-foreground max-w-md mx-auto">
            {isClient
              ? "I dati di traffico del sito non sono ancora disponibili: li collega il tuo referente W[r]Digital."
              : "Inserisci il Property ID di GA4 di questo sito per vedere traffico, comportamento e conversioni."}
          </div>
          {!isClient && onManage && <Button onClick={onManage} size="sm">Collega Analytics</Button>}
        </div>
      ) : error ? (
        <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Dati non disponibili: {error}</p>
      ) : shown ? (
        <Ga4OverviewPanel ga4Data={shown} isClient={isClient} periodLabel={periodLabel} />
      ) : null}
    </CollapsibleCard>
  )
}
