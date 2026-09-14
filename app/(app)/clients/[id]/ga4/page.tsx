"use client"

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, Users, Activity, Target, Euro } from 'lucide-react'
import { MetricoolCard } from '@/components/metricool/MetricoolCard'
import { MetricoolTable } from '@/components/metricool/MetricoolTable'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Row { key: string; sessions: number; users: number; conversions: number; revenue: number }
interface EventRow { event: string; count: number; per_session: number }
interface Data {
  propertyId: string
  totals: Record<string, number>
  channels: Row[]; sources: Row[]; pages: Row[]; devices: Row[]; countries: Row[]
  events: EventRow[]
}

const n = (v: number) => new Intl.NumberFormat('it-IT').format(Math.round(v))
const eur = (v: number) => `€${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(v)}`

export default function Ga4DetailPage() {
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
        const res = await fetch(`/api/clients/${id}/ga4?days=${days}`, {
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

  const columns = (label: string, render?: (r: Row) => React.ReactNode) => [
    { key: 'key', label, isPrimary: true, render: (r: Row) => render ? render(r) : (r.key || '(non impostato)') },
    { key: 'sessions', label: 'Sessioni', sortable: true, render: (r: Row) => n(r.sessions) },
    { key: 'users', label: 'Utenti', render: (r: Row) => n(r.users) },
    { key: 'conversions', label: 'Conversioni', render: (r: Row) => n(r.conversions) },
    { key: 'revenue', label: 'Revenue', sortable: true, render: (r: Row) => eur(r.revenue) },
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
          <h1 className="text-2xl font-bold tracking-tight">Google Analytics 4</h1>
          <p className="text-sm text-muted-foreground">Proprietà {data.propertyId}</p>
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
        <MetricoolCard title="Sessioni" value={data.totals.sessions} icon={Activity} variant="purple" />
        <MetricoolCard title="Utenti attivi" value={data.totals.active_users} icon={Users} variant="blue" />
        <MetricoolCard title="Conversioni" value={data.totals.conversions} icon={Target} variant="green" />
        <MetricoolCard title="Revenue" value={eur(data.totals.purchase_revenue)} icon={Euro} variant="orange" />
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Canali</h2>
        <MetricoolTable columns={columns('Canale', (r) => <Badge variant="outline" className="font-normal">{r.key || '(non impostato)'}</Badge>)}
          data={data.channels} filename="ga4_canali.csv" searchPlaceholder="Cerca canali..." />
      </section>

      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight">Sorgente / Mezzo</h2>
        <MetricoolTable columns={columns('Sorgente / Mezzo')} data={data.sources}
          filename="ga4_sorgenti.csv" searchPlaceholder="Cerca sorgenti..." />
      </section>

      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight">Pagine</h2>
        <MetricoolTable columns={columns('Pagina')} data={data.pages}
          filename="ga4_pagine.csv" searchPlaceholder="Cerca pagine..." />
      </section>

      {data.events.length > 0 && (
        <section className="space-y-4 pt-4 border-t">
          <h2 className="text-xl font-semibold tracking-tight">Eventi e-commerce</h2>
          {/* Non è un imbuto: su un sito reale i conteggi non rispettano
              l'ordine (si può comprare senza passare dal carrello), quindi
              mostrare un "calo fra step" produrrebbe percentuali sopra il 100%
              e un grafico che mente. Ogni evento sta per sé. */}
          <p className="text-sm text-muted-foreground -mt-2">
            Conteggi per evento, non una sequenza: molti siti permettono di acquistare senza
            passare dal carrello, quindi gli step non sono in ordine decrescente.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {data.events.map((e) => (
              <div key={e.event} className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-1">
                <p className="text-[11px] font-mono text-muted-foreground truncate">{e.event}</p>
                <p className="text-xl font-bold">{n(e.count)}</p>
                <p className="text-[11px] text-muted-foreground">{e.per_session}% delle sessioni</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid gap-8 md:grid-cols-2 pt-4 border-t">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Dispositivi</h2>
          <MetricoolTable columns={columns('Dispositivo', (r) => <Badge variant="outline" className="font-normal">{r.key}</Badge>)}
            data={data.devices} filename="ga4_dispositivi.csv" searchPlaceholder="Cerca..." />
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Paesi</h2>
          <MetricoolTable columns={columns('Paese')} data={data.countries}
            filename="ga4_paesi.csv" searchPlaceholder="Cerca..." />
        </div>
      </section>
    </div>
  )
}
