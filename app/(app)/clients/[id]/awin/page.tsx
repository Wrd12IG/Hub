"use client"

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AlertCircle, Handshake, Euro, ShoppingCart, TrendingUp } from 'lucide-react'
import { MetricoolCard } from '@/components/metricool/MetricoolCard'
import { MetricoolTable } from '@/components/metricool/MetricoolTable'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Publisher {
  publisher: string; transactions: number; sale_amount: number
  commission_amount: number; network_fee: number; total_cost: number
  roas: number; average_order_value: number; pending_transactions: number
}
interface Transaction {
  id: string; date: string; publisher: string; status: string
  sale_amount: number; commission_amount: number; device: string
  voucher: string; new_customer: boolean; decline_reason: string
}
interface Data {
  advertiserId: string
  totals: { transactions: number; sale_amount: number; total_cost: number; roas: number; pending_sale_amount: number }
  publishers: Publisher[]; transactions: Transaction[]
}

const n = (v: number) => new Intl.NumberFormat('it-IT').format(Math.round(v))
const eur = (v: number) => `€${new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}`

/** Un publisher può essere un dominio: l'URL intero rende la tabella illeggibile. */
const shortName = (s: string) => {
  try { return new URL(s).hostname.replace(/^www\./, '') } catch { return s }
}

const STATUS_STYLE: Record<string, string> = {
  approved: 'border-emerald-500/30 text-emerald-500',
  pending: 'border-amber-500/30 text-amber-500',
  declined: 'border-red-500/30 text-red-500',
}

export default function AwinDetailPage() {
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
        const res = await fetch(`/api/clients/${id}/awin?days=${days}`, {
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

  const publisherColumns = [
    { key: 'publisher', label: 'Publisher', isPrimary: true, render: (r: Publisher) => shortName(r.publisher) },
    { key: 'transactions', label: 'Ordini', sortable: true, render: (r: Publisher) => n(r.transactions) },
    { key: 'sale_amount', label: 'Fatturato', sortable: true, render: (r: Publisher) => eur(r.sale_amount) },
    { key: 'average_order_value', label: 'Scontrino', render: (r: Publisher) => eur(r.average_order_value) },
    { key: 'commission_amount', label: 'Commissioni', render: (r: Publisher) => eur(r.commission_amount) },
    { key: 'network_fee', label: 'Fee rete', render: (r: Publisher) => eur(r.network_fee) },
    { key: 'total_cost', label: 'Costo', render: (r: Publisher) => eur(r.total_cost) },
    { key: 'roas', label: 'ROAS', render: (r: Publisher) => `${r.roas}x` },
    { key: 'pending_transactions', label: 'Da confermare', render: (r: Publisher) => n(r.pending_transactions) },
  ]

  const transactionColumns = [
    { key: 'date', label: 'Data', isPrimary: true, sortable: true, render: (r: Transaction) => r.date },
    { key: 'publisher', label: 'Publisher', render: (r: Transaction) => shortName(r.publisher) },
    { key: 'status', label: 'Stato', render: (r: Transaction) => (
      <Badge variant="outline" className={`font-normal ${STATUS_STYLE[r.status] ?? ''}`}>
        {r.status}{r.decline_reason ? ` · ${r.decline_reason}` : ''}
      </Badge>
    ) },
    { key: 'sale_amount', label: 'Ordine', sortable: true, render: (r: Transaction) => eur(r.sale_amount) },
    { key: 'commission_amount', label: 'Commissione', render: (r: Transaction) => eur(r.commission_amount) },
    { key: 'device', label: 'Dispositivo', render: (r: Transaction) => r.device || '—' },
    { key: 'new_customer', label: 'Cliente', render: (r: Transaction) => r.new_customer ? 'nuovo' : 'di ritorno' },
    { key: 'voucher', label: 'Voucher', render: (r: Transaction) => r.voucher || '—' },
  ]

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Awin — Affiliazione</h1>
          <p className="text-sm text-muted-foreground">Advertiser {data.advertiserId}</p>
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
        <MetricoolCard title="Fatturato" value={eur(data.totals.sale_amount)} icon={Euro} variant="purple" />
        <MetricoolCard title="Ordini" value={data.totals.transactions} icon={ShoppingCart} variant="blue" />
        <MetricoolCard title="Costo canale" value={eur(data.totals.total_cost)} icon={Handshake} variant="orange" />
        <MetricoolCard title="ROAS" value={`${data.totals.roas}x`} icon={TrendingUp} variant="green" />
      </div>

      {/* La quota non ancora confermata è la cosa che un report di affiliazione
          nasconde più spesso: le commissioni maturano dopo settimane e il mese
          in corso è quasi sempre per metà provvisorio. */}
      {data.totals.pending_sale_amount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <AlertCircle size={16} className="shrink-0 text-amber-500" />
          <span>
            <strong>{eur(data.totals.pending_sale_amount)}</strong> non sono ancora confermati e possono
            essere respinti: nell&apos;affiliazione le commissioni maturano dopo settimane.
          </span>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Per publisher</h2>
        <MetricoolTable columns={publisherColumns} data={data.publishers}
          filename="awin_publisher.csv" searchPlaceholder="Cerca publisher..." />
      </section>

      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-xl font-semibold tracking-tight">Transazioni</h2>
        <MetricoolTable columns={transactionColumns} data={data.transactions}
          filename="awin_transazioni.csv" searchPlaceholder="Cerca transazioni..." />
      </section>
    </div>
  )
}
