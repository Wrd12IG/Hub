"use client"

import React, { useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuthFetch } from '@/hooks/useAuthFetch'

export interface SheetSummary { tab: string; lastStatus: string | null; lastSyncAt: string | null; lastMessage: string | null; issuesTotal: number; months: number }

const STATUS_CLS: Record<string, string> = { ok: 'text-emerald-600 dark:text-emerald-400', avvisi: 'text-amber-600 dark:text-amber-400', errore: 'text-red-600 dark:text-red-400' }
const btn = 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50'
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—')

/**
 * Collega lo Sheet Google di un cliente, lo rilegge e mostra l'esito. Stesse API della pagina «KPI concessionario» del cliente
 * (collegare e sincronizzare sono riservati agli amministratori: il server lo ricontrolla).
 */
export function DealerSheetDialog({ clientId, clientName, summary, serviceEmail, open, onOpenChange, onChanged }: {
  clientId: string; clientName: string; summary: SheetSummary | null; serviceEmail: string | null
  open: boolean; onOpenChange: (v: boolean) => void; onChanged: () => void
}) {
  const { authFetch } = useAuthFetch()
  const [url, setUrl] = useState('')
  const [tab, setTab] = useState(summary?.tab ?? 'Dati')
  const [busy, setBusy] = useState<string | null>(null)

  const call = async (label: string, run: () => Promise<Response>, ok: (j: any) => void) => {
    setBusy(label)
    try {
      const res = await run()
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j?.error || `Il server ha risposto ${res.status}.`)
      ok(j)
      onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Errore') } finally { setBusy(null) }
  }

  const link = () => call('link', () => authFetch(`/api/clients/${clientId}/dealer-kpi`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sheetUrl: url, tab }) }),
    (j) => { toast.success(j.removed ? 'Sheet scollegato.' : 'Sheet collegato: ora premi «Sincronizza ora».'); setUrl('') })
  const sync = () => call('sync', () => authFetch(`/api/clients/${clientId}/dealer-kpi/sync`, { method: 'POST' }),
    (j) => { const s = j.status; if (s.lastStatus === 'errore') toast.error(s.lastMessage); else toast.success(s.lastMessage) })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sheet Google · {clientName}</DialogTitle>
          <DialogDescription>Lead, appuntamenti, preventivi e vendite per marca e provenienza, compilati dal cliente. La hub lo legge in sola lettura.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {summary ? (
            <p>Collegato · scheda «{summary.tab}». {summary.lastSyncAt
              ? <>Ultima lettura {fmt(summary.lastSyncAt)}: <span className={STATUS_CLS[summary.lastStatus ?? ''] ?? ''}>{summary.lastMessage}</span></>
              : 'Non ancora sincronizzato.'}</p>
          ) : <p className="text-muted-foreground">Nessuno Sheet collegato.</p>}
          <div className="space-y-2">
            <input className="h-8 w-full rounded-lg border border-border bg-background px-2 text-sm" placeholder="Incolla il collegamento dello Sheet (https://docs.google.com/spreadsheets/d/…)" value={url} onChange={(e) => setUrl(e.target.value)} />
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-muted-foreground">Scheda <input className="ml-1 h-8 w-28 rounded-lg border border-border bg-background px-2 text-sm text-foreground" value={tab} onChange={(e) => setTab(e.target.value)} /></label>
              <button className={btn} disabled={busy !== null || (!url.trim() && !summary)} onClick={link}>{busy === 'link' && <Loader2 className="h-4 w-4 animate-spin" />} {url.trim() ? 'Collega' : 'Scollega'}</button>
              {summary && <button className={btn} disabled={busy !== null} onClick={sync}>{busy === 'sync' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sincronizza ora</button>}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Condividi lo Sheet, <b>come Visualizzatore</b>, con <code className="rounded bg-muted px-1">{serviceEmail ?? 'l\'account di servizio Google (non configurato)'}</code>. Si rilegge anche da solo ogni notte.
          </p>
          {summary && summary.issuesTotal > 0 && <p className="text-xs text-amber-600 dark:text-amber-400">{summary.issuesTotal} righe da correggere nello Sheet: il dettaglio è nella pagina «KPI concessionario» del cliente.</p>}
          <a className="text-xs underline" href={`/clients/${clientId}/dealer-kpi`}>Apri la pagina completa con totali e righe da correggere</a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
