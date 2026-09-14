"use client"

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, Mail, Send, MousePointerClick, Euro } from 'lucide-react'
import { MetricoolCard } from '@/components/metricool/MetricoolCard'
import { MetricoolTable } from '@/components/metricool/MetricoolTable'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Row {
  id: string; name: string; channel: string
  recipients: number; delivered: number; opens_unique: number; clicks_unique: number
  unsubscribes: number; conversions: number; conversion_value: number
  open_rate: number; click_rate: number; revenue_per_recipient: number
}
interface Data { accountName: string | null; campaigns: Row[]; flows: Row[] }

const n = (v: number) => new Intl.NumberFormat('it-IT').format(Math.round(v))
const eur = (v: number) => `€${new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}`
const sum = (rows: Row[], k: keyof Row) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)

export default function KlaviyoDetailPage() {
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
        const res = await fetch(`/api/clients/${id}/klaviyo-detail?days=${days}`, {
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

  const columns = (label: string) => [
    { key: 'name', label, isPrimary: true, render: (r: Row) => (
      <span className="flex items-center gap-2">
        {r.name}
        {r.channel && r.channel !== 'email' && <Badge variant="outline" className="font-normal">{r.channel}</Badge>}
      </span>
    ) },
    { key: 'recipients', label: 'Invii', sortable: true, render: (r: Row) => n(r.recipients) },
    { key: 'open_rate', label: 'Apertura', render: (r: Row) => `${r.open_rate.toFixed(2)}%` },
    { key: 'click_rate', label: 'Click', render: (r: Row) => `${r.click_rate.toFixed(2)}%` },
    { key: 'conversions', label: 'Conversioni', render: (r: Row) => n(r.conversions) },
    { key: 'conversion_value', label: 'Fatturato', sortable: true, render: (r: Row) => eur(r.conversion_value) },
    // Il numero che dice quanto vale davvero un contatto su quella lista.
    { key: 'revenue_per_recipient', label: 'Per invio', render: (r: Row) => eur(r.revenue_per_recipient) },
    { key: 'unsubscribes', label: 'Disiscritti', render: (r: Row) => n(r.unsubscribes) },
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

  const all = [...data.campaigns, ...data.flows]
  const totalRevenue = sum(all, 'conversion_value')
  const flowRevenue = sum(data.flows, 'conversion_value')

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Klaviyo</h1>
          {data.accountName && <p className="text-sm text-muted-foreground">{data.accountName}</p>}
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
        <MetricoolCard title="Fatturato email" value={eur(totalRevenue)} icon={Euro} variant="orange" />
        <MetricoolCard
          title="Quota dai flussi"
          value={totalRevenue > 0 ? `${((flowRevenue / totalRevenue) * 100).toFixed(1)}%` : '—'}
          icon={MousePointerClick} variant="green" />
        <MetricoolCard title="Invii totali" value={sum(all, 'recipients')} icon={Send} variant="blue" />
        <MetricoolCard title="Disiscritti" value={sum(all, 'unsubscribes')} icon={Mail} variant="purple" />
      </div>

      {/* I flussi prima delle campagne: su un e-commerce generano la maggior
          parte del fatturato con una frazione degli invii, quindi è la prima
          cosa da guardare — non una nota a piè di pagina. */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Flussi automatici</h2>
        <MetricoolTable columns={columns('Flusso')} data={data.flows}
          filename="klaviyo_flussi.csv" searchPlaceholder="Cerca flussi..." />
      </section>

      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight">Campagne</h2>
        <MetricoolTable columns={columns('Campagna')} data={data.campaigns}
          filename="klaviyo_campagne.csv" searchPlaceholder="Cerca campagne..." />
      </section>
    </div>
  )
}
