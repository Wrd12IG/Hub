"use client"

import React from 'react'
import Link from 'next/link'
import { RefreshCw, TrendingUp, Instagram, Facebook, Search as SearchIcon, Linkedin, AlertCircle, ArrowUpRight, MapPin, Mail, Handshake, Youtube } from 'lucide-react'
import { MetricoolCard } from '@/components/metricool/MetricoolCard'
import { Skeleton } from '@/components/ui/skeleton'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { ReportAlertList } from '@/components/ReportAlertList'
import { ReportProgress } from '@/components/ReportProgress'
import { PlatformDailyChart } from '@/components/PlatformDailyChart'
import { metricRowsFromSeries, type MetricRow } from '@/lib/report-series'
import { PLATFORM_DEFS, COST_KEYS, computeAlerts, type PlatformKey } from '@/lib/report-metrics'
import type { MarketingReportState } from '@/hooks/use-marketing-report'

// Icona, colore e pagina di dettaglio per piattaforma; etichette e metriche stanno in lib/report-metrics.ts
const PLATFORM_META: Record<PlatformKey, { icon: any; variant: 'blue' | 'orange' | 'green' | 'pink' | 'purple' | 'gray'; detail?: string }> = {
  facebook: { icon: Facebook, variant: 'blue', detail: 'meta-ads' },
  facebook_page: { icon: Facebook, variant: 'blue', detail: 'facebook' },
  youtube: { icon: Youtube, variant: 'orange', detail: 'youtube' },
  instagram: { icon: Instagram, variant: 'pink', detail: 'instagram' },
  google_ads: { icon: TrendingUp, variant: 'green', detail: 'google-ads' },
  ga4: { icon: TrendingUp, variant: 'purple', detail: 'ga4' },
  searchconsole: { icon: SearchIcon, variant: 'gray', detail: 'search-console' },
  linkedin_organic: { icon: Linkedin, variant: 'blue', detail: 'linkedin' },
  klaviyo: { icon: Mail, variant: 'orange', detail: 'klaviyo' },
  awin: { icon: Handshake, variant: 'purple', detail: 'awin' },
  gbp: { icon: MapPin, variant: 'green', detail: 'gbp' },
}

/**
 * Percentage change vs the comparison window. Returns undefined when there's
 * nothing meaningful to compare (no comparison requested, or a previous value
 * of zero, where a percentage would be either infinite or misleading).
 */
function trendFor(
  current: string | number | undefined,
  previous: string | number | undefined,
  inverse = false
): { value: number; isPositive: boolean } | undefined {
  if (typeof current !== 'number' || typeof previous !== 'number' || previous === 0) return undefined
  const delta = ((current - previous) / previous) * 100
  // Per i costi un calo è una buona notizia: il verde segue il significato, non il segno.
  return { value: Math.round(delta * 10) / 10, isPositive: inverse ? delta <= 0 : delta >= 0 }
}

export function MarketingReportTab({
  clientId,
  compare = 'none',
  report,
}: {
  clientId: string
  compare?: 'prev_period' | 'prev_year' | 'none'
  report: MarketingReportState
}) {
  const { platforms, loading, error: loadError, computedAt, fromCache, progress, reload: fetchReport } = report

  const connectedCount = platforms?.filter(p => p.connected).length ?? 0
  const noPlatformsConfigured = platforms !== null && platforms.length === 0

  // Gli avvisi vengono da lib/report-metrics.ts: scostamento oltre il 25% E base minima nel periodo precedente
  const alerts = computeAlerts(platforms ?? [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">
            Apri una piattaforma per vedere i dati, &quot;Dettaglio&quot; per la vista completa.
          </p>
          {computedAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              {fromCache ? 'Dati calcolati il' : 'Aggiornato il'}{' '}
              {new Date(computedAt).toLocaleString('it-IT', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              })}
              {fromCache && ' — premi Aggiorna per rileggere le piattaforme'}
            </p>
          )}
        </div>
        <button
          onClick={() => fetchReport(true)}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Aggiorna
        </button>
      </div>

      {/* Mentre si aggiorna: quante fonti sono già arrivate */}
      <ReportProgress loading={loading && !!platforms} progress={progress} />

      {!loadError && platforms && compare !== 'none' && (
        <ReportAlertList alerts={alerts} compare={compare as 'prev_period' | 'prev_year'} />
      )}

      {loading && !platforms && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      )}

      {!loading && loadError && (
        <div className="flex items-center gap-2 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm">
          <AlertCircle size={16} /> {loadError}
        </div>
      )}

      {!loading && !loadError && noPlatformsConfigured && (
        <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl border-dashed gap-2">
          <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
          <h3 className="font-semibold">Nessuna piattaforma collegata</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Vai nella tab <strong>Setup API</strong> e collega almeno un account (Meta Ads, Google Ads, GA4, Instagram, Search Console o LinkedIn) per vedere i primi dati qui.
          </p>
        </div>
      )}

      {/* Durante un ricarico (cambio periodo) restano i dati precedenti, attenuati:
          svuotare la sezione per 10-15s a ogni cambio sembrava che i dati fossero spariti. */}
      {!loadError && platforms && platforms.length > 0 && (
        <div className={`space-y-4 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`} aria-busy={loading}>
          {platforms.map((p) => {
            const meta = { ...PLATFORM_META[p.platform], ...PLATFORM_DEFS[p.platform] }
            const row = p.rows[0] || {}
            const prevRow = p.previousRows?.[0]
            // Andamento giornaliero della scheda: le righe della piattaforma, oppure (Meta e Google Ads) la loro serie di spesa e risultato
            const dailyRows: MetricRow[] =
              p.daily ?? (p.series && (p.platform === 'facebook' || p.platform === 'google_ads') ? metricRowsFromSeries(p.platform, p.series) : [])
            // Titolo della scheda chiusa: il RISULTATO (lead, conversioni, contatti), non la spesa. Si prende la prima
            // metrica del suo elenco che ha un valore; se nessuna ce l'ha, la prima mostrata.
            const headline = p.connected && p.rows.length > 0
              ? meta.metrics.find((m) => m.key === meta.headline.find((k) => typeof row[k] === 'number' && (row[k] as number) > 0)) ?? meta.metrics[0]
              : undefined
            const headlineTrend = headline ? trendFor(row[headline.key], prevRow?.[headline.key], COST_KEYS.has(headline.key)) : undefined
            return (
              // A platform can appear more than once (GBP: one entry per sede),
              // so the key has to include the account, not just the platform.
              <CollapsibleCard
                key={`${p.platform}-${p.accountLabel ?? 'single'}`}
                icon={meta.icon}
                title={meta.label}
                description={p.accountLabel}
                className="bg-white/[0.02] shadow-none"
                summary={
                  !p.connected ? <span className="text-xs font-semibold text-red-500">Errore</span>
                  : headline ? (
                    <span className="text-xs text-muted-foreground">
                      {headline.label}: <strong className="text-foreground">{typeof row[headline.key] === 'number' ? (row[headline.key] as number).toLocaleString('it-IT', { maximumFractionDigits: 2 }) : '—'}</strong>
                      {headlineTrend && (
                        <span className={`ml-1.5 font-semibold ${headlineTrend.isPositive ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                          {headlineTrend.value > 0 ? '+' : ''}{headlineTrend.value}%
                        </span>
                      )}
                    </span>
                  ) : undefined
                }
                actions={meta.detail ? (
                  <Link
                    href={`/clients/${clientId}/${meta.detail}${p.platform === 'gbp' && row.account_id ? `?sede=${encodeURIComponent(String(row.account_id))}` : ''}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    Dettaglio <ArrowUpRight size={13} />
                  </Link>
                ) : undefined}
              >
                {!p.connected && (
                  <div className="text-sm text-red-600 p-3 rounded-lg border border-red-200 bg-red-50">{p.error}</div>
                )}
                {p.connected && p.rows.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {meta.metrics.map(m => (
                        <MetricoolCard
                          key={m.key}
                          title={m.label}
                          value={(row[m.key] as number) ?? 0}
                          variant={meta.variant}
                          trend={trendFor(row[m.key], prevRow?.[m.key], COST_KEYS.has(m.key))}
                        />
                      ))}
                    </div>
                    {meta.chart && <PlatformDailyChart rows={dailyRows} metrics={meta.chart} />}
                  </>
                ) : p.connected ? (
                  <div className="text-sm text-muted-foreground p-4 border rounded-lg border-dashed">
                    Nessun dato nel periodo selezionato. Può voler dire che l'account non ha avuto attività — prova ad allargare il "Periodo" — oppure che l'id inserito in Setup API non corrisponde a un account collegato: da qui i due casi non sono distinguibili.
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-4 border rounded-lg border-dashed">
                    Dati non disponibili al momento per questa piattaforma.
                  </div>
                )}
              </CollapsibleCard>
            )
          })}
          <p className="text-xs text-muted-foreground pt-2">{connectedCount} di {platforms.length} piattaforme con dati disponibili. Per aggiungerne altre, vai in <strong>Setup API</strong>.</p>
        </div>
      )}
    </div>
  )
}
