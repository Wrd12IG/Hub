"use client"

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, Search as SearchIcon, MousePointerClick, Eye, TrendingUp } from 'lucide-react'
import { MetricoolCard } from '@/components/metricool/MetricoolCard'
import { MetricoolTable } from '@/components/metricool/MetricoolTable'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Row { key: string; clicks: number; impressions: number; ctr: number; position: number }
interface Data {
  siteUrl: string
  totals: { clicks: number; impressions: number; ctr: number; position: number }
  queries: Row[]; pages: Row[]; devices: Row[]; countries: Row[]
}

const n = (v: number) => new Intl.NumberFormat('it-IT').format(Math.round(v))

export default function SearchConsoleDetailPage() {
  const { id } = useParams() as { id: string }
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState<'7' | '30' | '90'>('30')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true); setError(null)
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`/api/clients/${id}/search-console?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
        if (!cancelled) setData(json)
      } catch (e: any) {
        if (!cancelled) setError(e.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id, days])

  // Le colonne sono le stesse per tutte e quattro le dimensioni: cambia solo
  // l'etichetta della prima, quindi una funzione invece di quattro copie.
  const columns = (label: string, primary?: (r: Row) => React.ReactNode) => [
    { key: 'key', label, isPrimary: true, render: (r: Row) => primary ? primary(r) : r.key },
    { key: 'clicks', label: 'Click', sortable: true, render: (r: Row) => n(r.clicks) },
    { key: 'impressions', label: 'Impression', sortable: true, render: (r: Row) => n(r.impressions) },
    // ctr arriva come frazione (0,0105): è la convenzione di Google, qui si
    // mostra in percentuale.
    { key: 'ctr', label: 'CTR', render: (r: Row) => `${(r.ctr * 100).toFixed(2)}%` },
    { key: 'position', label: 'Posizione', render: (r: Row) => r.position.toFixed(1) },
  ]

  if (loading) {
    return (
      <div className="flex-1 space-y-6 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto">
        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error || 'Nessun dato disponibile.'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Search Console</h1>
          <p className="text-sm text-muted-foreground">{data.siteUrl}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Periodo</span>
          <Select value={days} onValueChange={(v) => setDays(v as '7' | '30' | '90')}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Ultimi 7 giorni</SelectItem>
              <SelectItem value="30">Ultimi 30 giorni</SelectItem>
              <SelectItem value="90">Ultimi 90 giorni</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricoolCard title="Click organici" value={data.totals.clicks} icon={MousePointerClick} variant="blue" />
        <MetricoolCard title="Impression" value={data.totals.impressions} icon={Eye} variant="purple" />
        <MetricoolCard title="CTR" value={`${(data.totals.ctr * 100).toFixed(2)}%`} icon={TrendingUp} variant="green" />
        <MetricoolCard title="Posizione media" value={data.totals.position.toFixed(1)} icon={SearchIcon} variant="orange" />
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Query di ricerca</h2>
        <MetricoolTable columns={columns('Query')} data={data.queries}
          filename="search_console_query.csv" searchPlaceholder="Cerca query..." />
      </section>

      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight">Pagine</h2>
        <MetricoolTable
          columns={columns('Pagina', (r) => (
            <a href={r.key} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {/* Mostrare l'URL intero rende la tabella illeggibile: basta il path. */}
              {(() => { try { return new URL(r.key).pathname || '/' } catch { return r.key } })()}
            </a>
          ))}
          data={data.pages} filename="search_console_pagine.csv" searchPlaceholder="Cerca pagine..." />
      </section>

      <section className="grid gap-8 md:grid-cols-2 pt-4 border-t">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Dispositivi</h2>
          <MetricoolTable
            columns={columns('Dispositivo', (r) => <Badge variant="outline" className="font-normal">{r.key}</Badge>)}
            data={data.devices} filename="search_console_dispositivi.csv" searchPlaceholder="Cerca..." />
        </div>
        <div className="space-y-4">
          <h2 className="text-xl fontibold tracking-tight">Paesi</h2>
          <MetricoolTable
            columns={columns('Paese', (r) => <Badge variant="outline" className="font-normal uppercase">{r.key}</Badge>)}
            data={data.countries} filename="search_console_paesi.csv" searchPlaceholder="Cerca..." />
        </div>
      </section>
    </div>
  )
}
