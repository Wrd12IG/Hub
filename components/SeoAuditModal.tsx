"use client"

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, Gauge, Search, TrendingUp, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface SeoFactor { id: string; label: string; detail: string; weight: number; ratio: number; applicable: boolean }
interface SeoVital { id: string; label: string; value: string; status: 'good' | 'warn' | 'bad' }
interface SeoAudit {
  url: string
  score: number
  factors: SeoFactor[]
  vitals: SeoVital[]
  issues: { title: string; detail: string }[]
  lighthouse: { seo: number; performance: number }
  searchConsole: { clicks: number; impressions: number; ctr: number; position: number } | null
  ranAt: string
}

function scoreColor(score: number) {
  return score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400'
}

export function SeoAuditModal({
  isOpen, onClose, clientId, clientName, onSaved,
}: {
  isOpen: boolean
  onClose: () => void
  clientId: string
  clientName: string
  onSaved?: (score: number) => void
}) {
  const [audit, setAudit] = useState<SeoAudit | null>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` })

  const loadLast = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/seo-audit`, { headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Errore ${res.status}`)
      setAudit(data.audit)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { if (isOpen) loadLast() }, [isOpen, loadLast])

  async function runAudit() {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch(`/api/clients/${clientId}/seo-audit`, { method: 'POST', headers: headers() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Errore ${res.status}`)
      setAudit(data.audit)
      onSaved?.(data.audit.score)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background border border-white/10 rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-background/95 backdrop-blur border-b border-white/10 p-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <Gauge className="h-5 w-5 text-primary" /> Audit SEO — {clientName}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Misurato con Google PageSpeed Insights (mobile) e Search Console. Nessun dato simulato.
            </p>
          </div>
          <button onClick={onClose} aria-label="Chiudi" className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carico l&apos;ultimo audit...
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 text-rose-400 text-sm">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {!loading && !audit && !error && (
            <div className="text-center py-10 space-y-3">
              <p className="text-sm text-muted-foreground">
                Nessun audit ancora eseguito per questo cliente.
              </p>
            </div>
          )}

          {audit && (
            <>
              <div className="flex items-center justify-between gap-6 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    Punteggio SEO
                  </div>
                  <div className="text-xs text-muted-foreground/70 mt-1 break-all">{audit.url}</div>
                  <div className="text-[10px] text-muted-foreground/50 mt-1">
                    Eseguito il {new Date(audit.ranAt).toLocaleString('it-IT')}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn('text-4xl font-black leading-none', scoreColor(audit.score))}>
                    {audit.score}
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground/60 mt-1">/ 100</div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                  Come si compone
                </h3>
                {audit.factors.map((f) => (
                  <div
                    key={f.id}
                    className={cn(
                      'flex items-start justify-between gap-3 p-3 rounded-lg border text-xs',
                      f.applicable ? 'border-white/10 bg-white/[0.02]' : 'border-white/5 bg-transparent opacity-50',
                    )}
                  >
                    <div>
                      <div className="font-bold text-foreground">{f.label}</div>
                      <div className="text-muted-foreground mt-0.5">{f.detail}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-foreground">
                        {f.applicable ? `${Math.round(f.ratio * 100)}%` : 'n/d'}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60">peso {f.weight}%</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <TrendingUp size={13} /> Core Web Vitals (misurati in laboratorio)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {audit.vitals.map((v) => (
                    <div key={v.id} className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                      <div className="text-[10px] text-muted-foreground truncate">{v.label}</div>
                      <div
                        className={cn(
                          'text-sm font-black mt-1',
                          v.status === 'good' ? 'text-emerald-400' : v.status === 'warn' ? 'text-amber-400' : 'text-rose-400',
                        )}
                      >
                        {v.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {audit.issues.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Da sistemare — rilevati da Lighthouse su questo sito
                  </h3>
                  <ul className="space-y-1.5">
                    {audit.issues.map((i, idx) => (
                      <li key={idx} className="text-xs flex items-start gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                        <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                        <span>
                          <span className="font-semibold text-foreground">{i.title}</span>
                          {i.detail && <span className="text-muted-foreground"> — {i.detail}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {audit.searchConsole && (
                <div className="space-y-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Search size={13} /> Search Console (ultimi 30 giorni)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {[
                      { l: 'Click', v: audit.searchConsole.clicks.toLocaleString('it-IT') },
                      { l: 'Impression', v: audit.searchConsole.impressions.toLocaleString('it-IT') },
                      { l: 'CTR', v: `${(audit.searchConsole.ctr * 100).toFixed(2)}%` },
                      { l: 'Posizione media', v: audit.searchConsole.position.toFixed(1) },
                    ].map((m) => (
                      <div key={m.l} className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                        <div className="text-[10px] text-muted-foreground">{m.l}</div>
                        <div className="text-sm font-black text-foreground mt-1">{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="pt-2 flex items-center gap-3">
            <Button onClick={runAudit} disabled={running} className="font-bold">
              {running ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analisi in corso (~30s)...</>
              ) : audit ? (
                <><RefreshCw className="h-4 w-4 mr-2" /> Rigenera audit</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Esegui audit</>
              )}
            </Button>
            {running && (
              <span className="text-xs text-muted-foreground">
                Google sta caricando il sito e misurandone le performance reali.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
