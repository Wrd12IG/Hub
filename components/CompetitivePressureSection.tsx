"use client"

import React, { useEffect, useState } from 'react'
import { AlertCircle, Swords, TrendingDown, Wallet } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

interface Campaign {
  id: string; name: string; channel: string; impressions: number; cost: number
  impressionShare: number | null; bound: 'lt10' | 'gt90' | null
  rankLost: number; budgetLost: number; absoluteTop: number | null; clickShare: number | null
  diagnosi: 'competitor' | 'budget' | 'nessuna'
}
interface Data {
  campaigns: Campaign[]
  impressionShare: number | null
  rankLost: number; budgetLost: number
  boundedCampaigns: number; shareCoverage: number
  diagnosi: 'competitor' | 'budget' | 'nessuna'
  error?: string; notConfigured?: boolean
}

const pct = (v: number | null) => v === null ? '—' : `${(v * 100).toFixed(1)}%`
const share = (c: Campaign) =>
  c.impressionShare !== null ? pct(c.impressionShare) : c.bound === 'lt10' ? '<10%' : c.bound === 'gt90' ? '>90%' : '—'

const DIAGNOSI: Record<Campaign['diagnosi'], { testo: string; classe: string }> = {
  competitor: { testo: 'i competitor ti superano', classe: 'border-red-500/30 text-red-400' },
  budget: { testo: 'il budget finisce', classe: 'border-amber-500/30 text-amber-400' },
  nessuna: { testo: 'quadro equilibrato', classe: 'border-white/15 text-muted-foreground' },
}

export function CompetitivePressureSection({ clientId, daysBack }: { clientId: string; daysBack: number }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const days = daysBack >= 90 ? 90 : daysBack <= 7 ? 7 : 30
    ;(async () => {
      setLoading(true)
      try {
        const token = localStorage.getItem('token')
        const res = await fetch(`/api/clients/${clientId}/competitive-pressure?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const j = await res.json()
        if (!cancelled) setData(res.ok ? j : { ...j, campaigns: [] })
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [clientId, daysBack])

  if (loading) return <Skeleton className="h-40" />
  if (!data) return null

  if (data.notConfigured || data.error) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
        {data.error ?? 'Dati non disponibili.'}
      </div>
    )
  }

  if (data.campaigns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">
        Nessuna campagna con impression nel periodo: senza erogazione non c&apos;è pressione competitiva da misurare.
      </div>
    )
  }

  const d = DIAGNOSI[data.diagnosi]

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold flex items-center gap-2"><Swords size={16} /> Pressione competitiva</h3>
        <p className="text-xs text-muted-foreground">
          Quante delle ricerche disponibili stai prendendo su Google Ads, e perché perdi il resto.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-[11px] text-muted-foreground">Quota impression</p>
          <p className="text-2xl font-bold mt-0.5">{pct(data.impressionShare)}</p>
          {/* Quando Google non dà la quota esatta sulla maggior parte del
              volume, un numero d'account sarebbe calcolato su una minoranza:
              su un cliente reale usciva 91,5% da appena l'1% delle impression. */}
          {data.impressionShare === null && (
            <p className="text-[10px] text-amber-500/80 mt-1">
              Google non fornisce la quota esatta per {data.boundedCampaigns} campagne
              {data.shareCoverage > 0 && ` (dati precisi solo sul ${(data.shareCoverage * 100).toFixed(0)}% delle impression)`}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><TrendingDown size={11} /> Persa per posizionamento</p>
          <p className="text-2xl font-bold mt-0.5">{pct(data.rankLost)}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">I competitor ti battono su offerta e qualità</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><Wallet size={11} /> Persa per budget</p>
          <p className="text-2xl font-bold mt-0.5">{pct(data.budgetLost)}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">Arrivi primo ma finisci i fondi</p>
        </div>
      </div>

      {data.diagnosi !== 'nessuna' && (
        <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
          data.diagnosi === 'competitor' ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/10'
        }`}>
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>
            {data.diagnosi === 'competitor' ? (
              <>Perdi più impression <strong>perché i competitor ti superano</strong> ({pct(data.rankLost)}) che
              per budget esaurito ({pct(data.budgetLost)}): alzare la spesa serve a poco se prima non migliorano
              offerte e pertinenza.</>
            ) : (
              <>Perdi più impression <strong>perché il budget finisce</strong> ({pct(data.budgetLost)}) che per
              posizionamento ({pct(data.rankLost)}): la domanda c&apos;è e la stai vincendo, manca copertura.</>
            )}
          </span>
        </div>
      )}

      <div className="space-y-1.5">
        {data.campaigns.slice(0, 8).map((c) => {
          const cd = DIAGNOSI[c.diagnosi]
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-3 text-xs rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
              <span className="flex-1 min-w-[180px] truncate font-medium">{c.name}</span>
              <span className="text-muted-foreground">quota <strong className="text-foreground">{share(c)}</strong></span>
              <span className="text-muted-foreground">rank {pct(c.rankLost)}</span>
              <span className="text-muted-foreground">budget {pct(c.budgetLost)}</span>
              <Badge variant="outline" className={`font-normal text-[10px] ${cd.classe}`}>{cd.testo}</Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}
