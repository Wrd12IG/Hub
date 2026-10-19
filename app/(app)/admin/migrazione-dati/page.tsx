"use client"

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'

type Mode = 'prova' | 'copia' | 'rimuovi'
const STEPS: { mode: Mode; label: string; hint: string }[] = [
  { mode: 'prova', label: '1. Prova', hint: 'Non scrive nulla: elenca cosa verrebbe copiato.' },
  { mode: 'copia', label: '2. Copia', hint: 'Copia piano media e post-lead nell\'area riservata, senza toccare l\'originale.' },
  { mode: 'rimuovi', label: '3. Rimuovi i vecchi campi', hint: 'Da fare DOPO aver pubblicato le regole Firestore: toglie il vecchio campo solo dove la copia è identica.' },
]

/** Pagina di servizio, da usare una volta: sposta i dati interni dei clienti nell'area solo-staff (vedi lib/client-private-migrate.ts). */
export default function MigrazioneDatiPage() {
  const { authFetch } = useAuthFetch()
  const { currentUser } = useLayoutData()
  const [busy, setBusy] = useState<Mode | null>(null)
  const [out, setOut] = useState<string>('')

  if (currentUser?.role !== 'Amministratore') {
    return <p className="p-6 text-sm text-muted-foreground">Pagina riservata agli amministratori.</p>
  }

  const run = async (mode: Mode) => {
    if (mode === 'rimuovi' && !window.confirm('Hai già pubblicato le regole Firestore? Questo passo toglie i vecchi campi dal documento cliente (solo dove la copia è identica).')) return
    setBusy(mode); setOut('')
    try {
      const res = await authFetch('/api/admin/migrate-client-private', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setOut(`Errore: ${j?.error || res.status}`); return }
      setOut([...j.log, '', `Fatto (${j.mode}). copiati: ${j.copied}, rimossi: ${j.deleted}, non verificati: ${j.mismatched}, da copiare (prova): ${j.skipped}`].join('\n'))
    } catch (e: any) {
      setOut(`Errore: ${e.message}`)
    } finally { setBusy(null) }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Migrazione dati interni dei clienti</h1>
        <p className="mt-1 text-sm text-muted-foreground">Piano media e dati post-lead passano nell'area riservata allo staff, così l'utente Cliente non può leggerli. Si fa una volta sola, in ordine.</p>
      </div>
      <ul className="space-y-3">
        {STEPS.map((s) => (
          <li key={s.mode} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div className="min-w-0"><p className="font-semibold text-foreground">{s.label}</p><p className="text-xs text-muted-foreground">{s.hint}</p></div>
            <Button size="sm" variant={s.mode === 'prova' ? 'outline' : 'default'} disabled={!!busy} onClick={() => run(s.mode)}>{busy === s.mode ? 'In corso…' : 'Esegui'}</Button>
          </li>
        ))}
      </ul>
      {out && <pre className="whitespace-pre-wrap rounded-xl border border-border bg-muted/40 p-4 text-xs text-foreground">{out}</pre>}
    </div>
  )
}
