"use client"

import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AccountConnector, WindsorAccount } from '@/lib/windsor-accounts'

const fieldClass = 'w-full text-sm bg-background border border-border text-foreground px-3 py-2.5 rounded-lg outline-none transition-all placeholder:text-muted-foreground focus:border-primary/60'

/** L'elenco degli account di un collegamento, con il suo stato: in caricamento, disponibile, non attivo, o non raggiungibile. */
function useAccounts(connector: AccountConnector) {
  const [accounts, setAccounts] = useState<WindsorAccount[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/windsor/accounts?connector=${connector}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
        const j = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok && !j.notActive) setAccounts(j.accounts ?? [])
        else setMessage(j.message || j.error || 'Elenco non disponibile.')
      } catch {
        if (!cancelled) setMessage('Elenco non disponibile.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [connector])

  return { accounts, message, loading }
}

/**
 * Sceglie l'account da un elenco (nome e ID) invece di scrivere l'ID a mano. Se l'elenco non c'è (collegamento non attivo o
 * servizio che non risponde) resta il campo di testo, con il motivo scritto. «Altro» permette comunque di scrivere un ID.
 */
export function AccountPicker({ connector, value, onChange, placeholder }: {
  connector: AccountConnector
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  const { accounts, message, loading } = useAccounts(connector)
  const [other, setOther] = useState(false)

  if (loading) {
    return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Carico l&apos;elenco degli account…</p>
  }
  if (!accounts) {
    return (
      <div className="space-y-1.5">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label="ID account" className={fieldClass} />
        {message && <p className="text-xs text-amber-700 dark:text-amber-400">{message} Scrivi l&apos;ID a mano.</p>}
      </div>
    )
  }

  const known = accounts.some((a) => a.id === value)
  const manual = other || (!!value && !known)
  const chosen = accounts.find((a) => a.id === value)
  return (
    <div className="space-y-1.5">
      <select
        aria-label="Account"
        value={manual ? '__other' : value}
        onChange={(e) => {
          if (e.target.value === '__other') { setOther(true); return }
          setOther(false)
          onChange(e.target.value)
        }}
        className={fieldClass}
      >
        <option value="">Scegli un account…</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        <option value="__other">Altro: scrivo l&apos;ID a mano</option>
      </select>
      {manual && <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label="ID account" className={fieldClass} />}
      {chosen && <p className="text-xs text-muted-foreground">ID: <span className="font-mono">{chosen.id}</span></p>}
    </div>
  )
}

/** Aggiunge sedi (GBP) da un elenco: ogni scelta viene passata a chi la gestisce e il menu torna vuoto. */
export function AccountAppender({ connector, taken, onAdd }: { connector: AccountConnector; taken: string[]; onAdd: (id: string) => void }) {
  const { accounts, message, loading } = useAccounts(connector)
  if (loading) return <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Carico l&apos;elenco delle sedi…</p>
  if (!accounts) return message ? <p className="text-xs text-amber-700 dark:text-amber-400">{message} Scrivi gli ID a mano.</p> : null
  const free = accounts.filter((a) => !taken.includes(a.id))
  return (
    <select
      aria-label="Aggiungi una sede"
      value=""
      onChange={(e) => { if (e.target.value) onAdd(e.target.value) }}
      className={fieldClass}
    >
      <option value="">{free.length ? `Aggiungi una sede dall'elenco (${free.length})…` : 'Tutte le sedi dell\'elenco sono già aggiunte'}</option>
      {free.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
  )
}
