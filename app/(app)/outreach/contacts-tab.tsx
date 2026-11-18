"use client"

import React, { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { OutreachContactItem } from '@/lib/outreach'
import { EMAIL_STATUS, PROSPECT_STATUS } from './shared'

const PAGE = 100
const input = 'h-8 rounded-lg border border-border bg-background px-3 text-sm'

export function ContactsTab({ contacts }: { contacts: OutreachContactItem[] }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [email, setEmail] = useState('')
  const [shown, setShown] = useState(PAGE)

  const statuses = useMemo(() => Array.from(new Set(contacts.map((c) => c.status).filter(Boolean))).sort(), [contacts])
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return contacts
      .filter((c) => (!status || c.status === status) && (!email || c.emailStatus === email))
      .filter((c) => !t || [c.company, c.name, c.email, c.title].some((x) => x.toLowerCase().includes(t)))
      .sort((a, b) => b.score - a.score || a.company.localeCompare(b.company))
  }, [contacts, q, status, email])

  if (contacts.length === 0) return <p className="text-sm text-muted-foreground">Nessun contatto ancora.</p>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <input className={`${input} w-64 pl-8`} placeholder="Cerca azienda, nome, email" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE) }} />
        </div>
        <select className={input} value={status} onChange={(e) => { setStatus(e.target.value); setShown(PAGE) }} aria-label="Stato del contatto">
          <option value="">Tutti gli stati</option>
          {statuses.map((s) => <option key={s} value={s}>{PROSPECT_STATUS[s] ?? s}</option>)}
        </select>
        <select className={input} value={email} onChange={(e) => { setEmail(e.target.value); setShown(PAGE) }} aria-label="Stato dell'indirizzo">
          <option value="">Ogni indirizzo</option>
          {Object.entries(EMAIL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="text-sm text-muted-foreground">{rows.length} su {contacts.length}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="p-2 font-medium">Contatto</th><th className="p-2 font-medium">Azienda</th><th className="p-2 font-medium">Indirizzo</th>
              <th className="p-2 font-medium">Stato</th><th className="p-2 text-right font-medium">Punteggio</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map((c) => {
              const es = EMAIL_STATUS[c.emailStatus]
              return (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-2">{c.name || <span className="text-muted-foreground">Casella generica</span>}{c.title && <div className="text-xs text-muted-foreground">{c.title}</div>}</td>
                  <td className="p-2">{c.company || '—'}</td>
                  <td className="p-2">
                    {c.email}
                    {es && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${es.cls}`}>{es.label}</span>}
                  </td>
                  <td className="p-2">{PROSPECT_STATUS[c.status] ?? c.status}</td>
                  <td className="p-2 text-right tabular-nums">{c.score}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length > shown && (
        <button className="text-sm font-medium underline underline-offset-2" onClick={() => setShown(shown + PAGE)}>Mostra altri {Math.min(PAGE, rows.length - shown)}</button>
      )}
      <p className="text-xs text-muted-foreground">Sellbird invia solo agli indirizzi verificati. Gli altri restano in elenco ma non ricevono email.</p>
    </div>
  )
}
