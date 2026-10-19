"use client"

import React, { useEffect, useState } from 'react'
import { MessageSquareText } from 'lucide-react'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { currentMonth, monthLabel } from '@/lib/monthly-comment'

/** Il commento mensile dello staff, in sola lettura (accesso «Cliente»). Senza commento non mostra nulla. */
export function ClientCommentCard({ clientId }: { clientId: string }) {
  const { authFetch } = useAuthFetch()
  const [text, setText] = useState('')
  const month = currentMonth()

  useEffect(() => {
    let cancelled = false
    authFetch(`/api/clients/${clientId}/comments?month=${month}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setText(d?.text ?? '') })
      .catch(() => {})
    return () => { cancelled = true }
  }, [clientId, month, authFetch])

  if (!text.trim()) return null
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-foreground">
        <MessageSquareText className="h-4 w-4 text-primary" /> Il commento di W[r]Digital · {monthLabel(month)}
      </h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{text.trim()}</p>
    </section>
  )
}
