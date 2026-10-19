"use client"

import React, { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { cn } from '@/lib/utils'

interface Issue { title: string; detail?: string }
interface Vital { id: string; label: string; value: string; status: 'good' | 'warn' | 'bad' }
interface Audit { score: number; ranAt: string; issues: Issue[]; vitals: Vital[] }

const STATUS: Record<Vital['status'], string> = { good: 'text-emerald-700 dark:text-emerald-400', warn: 'text-amber-700 dark:text-amber-400', bad: 'text-rose-700 dark:text-rose-400' }

/**
 * Cosa dice l'ultimo audit SEO, senza aprirlo: le tre cose principali da sistemare e i tempi di caricamento del sito.
 * Legge l'ultimo audit salvato (non ne esegue uno nuovo: costa una chiamata esterna ed è dello staff).
 */
export function SeoAuditHighlights({ clientId }: { clientId: string }) {
  const { authFetch } = useAuthFetch()
  const [audit, setAudit] = useState<Audit | null>(null)

  useEffect(() => {
    let cancelled = false
    authFetch(`/api/clients/${clientId}/seo-audit`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setAudit(d?.audit ?? null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [clientId, authFetch])

  if (!audit) return null
  const issues = (audit.issues || []).slice(0, 3)
  const vitals = (audit.vitals || []).slice(0, 4)

  return (
    <div className="space-y-4">
      {vitals.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {vitals.map((v) => (
            <div key={v.id} className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="truncate text-xs text-muted-foreground">{v.label}</div>
              <div className={cn('mt-1 text-sm font-bold', STATUS[v.status])}>{v.value}</div>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-2">
        <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Da sistemare per primo</h4>
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Nessun problema rilevato nell'ultimo audit.</p>
        ) : (
          <ul className="space-y-1.5">
            {issues.map((i, idx) => (
              <li key={idx} className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span><span className="font-semibold text-foreground">{i.title}</span>{i.detail && <span className="text-muted-foreground"> — {i.detail}</span>}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">Ultimo audit del {new Date(audit.ranAt).toLocaleDateString('it-IT')}. «Apri audit SEO» mostra il dettaglio completo.</p>
      </div>
    </div>
  )
}
