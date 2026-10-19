"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { MAX_COMMENT_LENGTH, currentMonth, monthLabel, recentMonths } from '@/lib/monthly-comment'

/**
 * Il commento che il cliente legge in cima alla sua pagina dei risultati (link pubblico): una nota per mese, scritta dallo staff.
 * Testo vuoto + Salva = commento tolto.
 */
export function MonthlyCommentEditor({ clientId }: { clientId: string }) {
  const { authFetch } = useAuthFetch()
  const [month, setMonth] = useState(currentMonth())
  const [text, setText] = useState('')
  const [saved, setSaved] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/clients/${clientId}/comments?month=${month}`)
      if (!res.ok) throw new Error()
      const d = await res.json()
      setText(d.text || '')
      setSaved(d.text || '')
      setSavedAt(d.updatedAt ?? null)
    } catch {
      setError('Impossibile caricare il commento.')
    } finally {
      setLoading(false)
    }
  }, [authFetch, clientId, month])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await authFetch(`/api/clients/${clientId}/comments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, text }),
      })
      if (!res.ok) throw new Error()
      const d = await res.json()
      setText(d.text)
      setSaved(d.text)
      setSavedAt(d.updatedAt)
    } catch {
      setError('Salvataggio non riuscito, riprova.')
    } finally {
      setSaving(false)
    }
  }

  const dirty = text.trim() !== saved

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-foreground">
            <MessageSquareText size={16} /> Commento mensile per il cliente
          </h3>
          <p className="text-xs text-muted-foreground">Lo legge il cliente nella sua pagina dei risultati, sopra i numeri.</p>
        </div>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="Mese del commento"
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm capitalize"
        >
          {recentMonths().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={MAX_COMMENT_LENGTH}
        rows={6}
        disabled={loading}
        placeholder="Come è andato il mese, cosa abbiamo fatto, cosa faremo nel prossimo."
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {error ? <span className="text-destructive">{error}</span>
            : savedAt && !dirty ? <span className="inline-flex items-center gap-1"><Check size={12} /> Salvato il {new Date(savedAt).toLocaleDateString('it-IT')}</span>
            : `${text.length}/${MAX_COMMENT_LENGTH}`}
        </p>
        <Button size="sm" onClick={save} disabled={saving || loading || !dirty}>
          {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}Salva
        </Button>
      </div>
    </div>
  )
}
