"use client"

import React, { useMemo, useState } from "react"
import { Globe, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ClientSitesDialog } from "@/components/client-sites-dialog"
import { SiteDomainCard } from "@/components/site-domain-card"
import { brandsOf, filterByBrand, type ClientSite } from "@/lib/client-sites"

/**
 * Il filtro per marca. Si mostra solo se serve: con un sito solo, o con siti senza nessuna marca, non c'è nulla da filtrare.
 * Il filtro non somma niente: sceglie quali schede mostrare.
 */
export function SiteBrandFilter({ sites, brand, onChange }: { sites: ClientSite[]; brand: string | null; onChange: (brand: string | null) => void }) {
  const brands = useMemo(() => brandsOf(sites), [sites])
  if (sites.length < 2 || brands.length === 0) return null
  const chip = (active: boolean) => `rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"}`
  return (
    <div role="group" aria-label="Filtra per marca" className="flex flex-wrap items-center gap-1.5">
      <button type="button" aria-pressed={brand === null} onClick={() => onChange(null)} className={chip(brand === null)}>Tutte le marche</button>
      {brands.map((b) => (
        <button key={b} type="button" aria-pressed={brand?.toLowerCase() === b.toLowerCase()} onClick={() => onChange(b)} className={chip(brand?.toLowerCase() === b.toLowerCase())}>{b}</button>
      ))}
    </div>
  )
}

export interface ClientSitesSectionProps {
  clientId: string
  sites: ClientSite[]
  isClient: boolean
  brand: string | null
  onBrandChange: (brand: string | null) => void
  range: { from: string; to: string } | null
  daysBack: number
  compareMode: string
  periodLabel: string
  /** I dati del primo sito, già letti dalla pagina (che li usa anche per altre schede). */
  firstSite: { data: any | null; loading: boolean }
  /** Dopo il salvataggio dei siti: la pagina aggiorna il cliente. */
  onSitesSaved: (sites: ClientSite[]) => void
}

/**
 * La parte della Panoramica con i siti del cliente: filtro per marca, «Gestisci siti» (solo staff) e una scheda
 * «Performance dominio» per sito. Un cliente con un sito solo vede ciò che vedeva prima.
 */
export function ClientSitesSection(props: ClientSitesSectionProps) {
  const { clientId, sites, isClient, brand, onBrandChange, range, daysBack, compareMode, periodLabel, firstSite, onSitesSaved } = props
  const [managing, setManaging] = useState(false)
  const visible = filterByBrand(sites, brand)
  const manage = isClient ? undefined : () => setManaging(true)

  return (
    <>
      {(!isClient || sites.length > 1) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SiteBrandFilter sites={sites} brand={brand} onChange={onBrandChange} />
          {!isClient && (
            <Button type="button" size="sm" variant="outline" onClick={manage} className="ml-auto">
              <Settings2 className="mr-2 h-4 w-4" />
              {sites.length === 0 ? "Aggiungi un sito" : sites.length === 1 ? "Gestisci siti" : `Gestisci siti (${sites.length})`}
            </Button>
          )}
        </div>
      )}

      {sites.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <Globe className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">Nessun sito collegato</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            {isClient ? "I dati di traffico del sito non sono ancora disponibili: li collega il tuo referente W[r]Digital." : "Aggiungi il sito del cliente (o i siti, uno per marca) con il suo Analytics e la sua Search Console."}
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Nessun sito per la marca «{brand}».</p>
      ) : (
        visible.map((site) => (
          <SiteDomainCard
            key={site.id}
            clientId={clientId}
            site={site}
            isClient={isClient}
            range={range}
            daysBack={daysBack}
            compareMode={compareMode}
            periodLabel={periodLabel}
            prefetched={site.id === sites[0].id ? firstSite : undefined}
            onManage={manage}
          />
        ))
      )}

      {!isClient && <ClientSitesDialog clientId={clientId} sites={sites} open={managing} onOpenChange={setManaging} onSaved={onSitesSaved} />}
    </>
  )
}
