import type { OutreachDiscoverInfo, OutreachCampaignItem, OutreachCompanyItem, OutreachContactItem, OutreachOutboxItem, OutreachReplyItem, OutreachSignalItem, OutreachStats } from '@/lib/outreach'

export type Meta = {
  syncedAt: string
  outboxCounts: Record<string, number>
  companies: number
  stats: OutreachStats | null
  sendingPaused: string | null
  campaigns?: OutreachCampaignItem[]
  exclusions?: string[]
  signals?: OutreachSignalItem[]
  discover?: OutreachDiscoverInfo | null
}

export type ExclusionChange = { action: 'add' | 'remove'; domain: string }

export type Pending = { outboxId: string | null; domain?: string | null; changes?: ExclusionChange[] | null; action: 'dnc_batch' | 'dnc_add' | 'dnc_remove' | 'approve' | 'reject' | 'pause_sending' | 'resume_sending' | 'discover_estimate' | 'discover_run' | 'signals_set' }

/** Un'azione con parametri chiesta dalla hub (Discover, segnali), con il suo stato e quello che Sellbird ha risposto. */
export type ActionRecord = {
  id: string
  action: 'discover_estimate' | 'discover_run' | 'signals_set'
  status: 'pending' | 'applied' | 'failed'
  provider: string | null
  cities: string[]
  industries: string[]
  maxSpend: number | null
  codes: string[]
  signalStatus: 'confirmed' | 'rejected' | null
  estimatedCost: number | null
  result: string | null
  error: string | null
  used: boolean
  requestedAt: string | null
  appliedAt: string | null
}

export type Overview = {
  meta: Meta | null
  outbox: OutreachOutboxItem[]
  companies: OutreachCompanyItem[]
  contacts: OutreachContactItem[]
  replies: OutreachReplyItem[]
  pending: Pending[]
  actions: ActionRecord[]
}

export const btn =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90'

export const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export const INTENT: Record<string, { label: string; cls: string }> = {
  interested: { label: 'Interessato', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  accepted_offer: { label: 'Ha accettato l\'offerta', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  question: { label: 'Domanda', cls: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  objection: { label: 'Obiezione', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  not_interested: { label: 'Non interessato', cls: 'bg-muted text-muted-foreground' },
  unsubscribe: { label: 'Disiscrizione', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  ooo: { label: 'Fuori ufficio', cls: 'bg-muted text-muted-foreground' },
  wrong_person: { label: 'Persona sbagliata', cls: 'bg-muted text-muted-foreground' },
  escalate: { label: 'Da gestire a mano', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  needs_human: { label: 'Serve una persona', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' },
}
export const intentOf = (intent: string) => INTENT[intent] ?? { label: 'Da classificare', cls: 'bg-muted text-muted-foreground' }

export const PROSPECT_STATUS: Record<string, string> = {
  new: 'Nuovi',
  contacted: 'Contattati',
  replied: 'Hanno risposto',
  opted_out: 'Disiscritti',
  bounced: 'Indirizzo non valido',
  no_tip: 'Senza spunto',
  queued: 'In coda',
}

export const EMAIL_STATUS: Record<string, { label: string; cls: string }> = {
  verified: { label: 'Verificato', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  risky: { label: 'Rischioso', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  guess: { label: 'Ipotizzato', cls: 'bg-muted text-muted-foreground' },
}
