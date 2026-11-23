"use client"

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthFetch } from '@/hooks/useAuthFetch'
import { useLayoutData } from '@/app/(app)/layout-context'
import { btn } from '@/app/(app)/outreach/shared'
import { parseAssignmentsSheet } from '@/lib/assignments/parse'
import { matchClient, matchUser } from '@/lib/assignments/match'
import { buildPlan } from '@/lib/assignments/plan'
import { ASSIGNMENTS_EFFECTIVE_FROM, type AssignClient, type AssignUser, type SheetRow } from '@/lib/assignments/model'

type U = AssignUser & { backupUserId: string | null }
const sel = 'h-8 w-full max-w-[260px] rounded-lg border border-border bg-background px-2 text-sm'
const STATUS_CLS: Record<string, string> = {
  esatto: 'text-emerald-600 dark:text-emerald-400', probabile: 'text-amber-600 dark:text-amber-400',
  ambiguo: 'text-red-600 dark:text-red-400', nessuno: 'text-red-600 dark:text-red-400',
}

export default function AssignmentsPage() {
  const { currentUser } = useLayoutData()
  const { authFetch } = useAuthFetch()
  const isAdmin = currentUser?.role === 'Amministratore'
  const [users, setUsers] = useState<U[]>([])
  const [clients, setClients] = useState<AssignClient[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [rows, setRows] = useState<SheetRow[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [userChoice, setUserChoice] = useState<Record<string, string>>({})
  const [clientChoice, setClientChoice] = useState<Record<number, string | null>>({})
  const [applying, setApplying] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/assegnazioni')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      setUsers(json.users); setClients(json.clients)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore di caricamento')
    } finally { setLoading(false) }
  }, [authFetch])
  useEffect(() => { if (isAdmin) load(); else setLoading(false) }, [isAdmin, load])

  const readSheet = () => {
    const r = parseAssignmentsSheet(text)
    setRows(r.rows); setWarnings(r.warnings)
    // Scelte iniziali: solo gli abbinamenti sicuri. I dubbi restano vuoti e li sceglie una persona.
    const cc: Record<number, string | null> = {}
    for (const row of r.rows) {
      const m = matchClient(row.clientName, clients)
      cc[row.row] = m.candidates.length === 1 && (m.status === 'esatto' || m.status === 'probabile') ? m.candidates[0].id : null
    }
    const uc: Record<string, string> = {}
    for (const name of Array.from(new Set(r.rows.flatMap((x) => [x.referente, x.backup]).filter(Boolean)))) {
      const m = matchUser(name, users)
      if (m.candidates.length === 1) uc[name] = m.candidates[0].id
    }
    setClientChoice(cc); setUserChoice(uc)
  }

  const names = useMemo(() => Array.from(new Set(rows.flatMap((x) => [x.referente, x.backup]).filter(Boolean))), [rows])
  const staff = useMemo(() => users.filter((u) => u.role !== 'Cliente' && u.status !== 'Inattivo').sort((a, b) => a.name.localeCompare(b.name)), [users])
  const plan = useMemo(() => buildPlan({ rows, clients, users, userChoice, clientChoice }), [rows, clients, users, userChoice, clientChoice])
  const planned = new Set(plan.clientChanges.map((c) => c.clientId))
  const unassigned = clients.filter((c) => !planned.has(c.id) && !c.referenteId)
  const nameOf = (id: string | null | undefined) => (id ? users.find((u) => u.id === id)?.name ?? id : '—')

  const apply = async () => {
    setApplying(true)
    try {
      const res = await authFetch('/api/admin/assegnazioni', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientChanges: plan.clientChanges.map(({ clientId, referenteId, peso, direzionale }) => ({ clientId, referenteId, peso, direzionale })),
          userChanges: plan.userChanges.map(({ userId, backupUserId }) => ({ userId, backupUserId })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `Il server ha risposto ${res.status}.`)
      toast.success(`Salvato: ${json.clients} clienti e ${json.users} backup.`)
      setRows([]); setText('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Errore nel salvataggio')
    } finally { setApplying(false) }
  }

  if (!isAdmin) return <p className="p-6 text-sm text-muted-foreground">Solo gli amministratori possono gestire le assegnazioni.</p>
  if (loading) return <div className="p-6"><Loader2 className="h-5 w-5 animate-spin" /></div>

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-xl font-semibold">Assegnazioni</h1>
        <p className="text-sm text-muted-foreground">
          Un referente per cliente e un backup per ogni utente. Qui li carichi dal foglio; la nuova visibilità dei task parte il {new Date(ASSIGNMENTS_EFFECTIVE_FROM).toLocaleDateString('it-IT', { dateStyle: 'long' })}.
          Salvare non cambia ancora nessun permesso.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">1. Incolla il foglio</h2>
        <p className="text-xs text-muted-foreground">Da Excel: seleziona le celle (con la riga delle intestazioni), copia e incolla qui. Colonne: Nome cliente · Direzionale · Peso · Referente · Backup.</p>
        <textarea className="min-h-[120px] w-full rounded-lg border border-border bg-background p-2 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder="Nome cliente	Direzionale	Peso	Referente	Backup" />
        <button className={btn} disabled={!text.trim()} onClick={readSheet}>Leggi il foglio</button>
        {warnings.map((w, i) => <p key={i} className="text-xs text-amber-600 dark:text-amber-400">{w}</p>)}
      </section>

      {rows.length > 0 && (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-medium">2. Le persone</h2>
            <p className="text-xs text-muted-foreground">Nel foglio ci sono solo i nomi: scegli a quale utente corrispondono. Se due persone hanno lo stesso nome, lo scegli tu.</p>
            {names.map((n) => {
              const m = matchUser(n, users)
              return (
                <div key={n} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-32 font-medium">{n}</span>
                  <select className={sel} value={userChoice[n] ?? ''} onChange={(e) => setUserChoice((p) => ({ ...p, [n]: e.target.value }))}>
                    <option value="">— scegli —</option>
                    {staff.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                  </select>
                  {m.status === 'ambiguo' && <span className={`text-xs ${STATUS_CLS.ambiguo}`}>più persone con questo nome</span>}
                </div>
              )
            })}
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">3. I clienti</h2>
            <div className="space-y-1">
              {rows.map((r) => {
                const m = matchClient(r.clientName, clients)
                return (
                  <div key={r.row} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm">
                    <span className="w-52 shrink-0 font-medium">{r.clientName}</span>
                    <select className={sel} value={clientChoice[r.row] ?? ''} onChange={(e) => setClientChoice((p) => ({ ...p, [r.row]: e.target.value || null }))}>
                      <option value="">— salta questa riga —</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <span className={`text-xs ${STATUS_CLS[m.status]}`}>{m.status === 'nessuno' ? 'nessun cliente corrisponde' : m.status}</span>
                    <span className="text-xs text-muted-foreground">referente {r.referente} · backup {r.backup || '—'} · peso {r.peso ?? '—'} · {r.direzionale === null ? '' : r.direzionale ? 'direzionale' : 'non direzionale'}</span>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">4. Anteprima: cosa verrà scritto</h2>
            {plan.problems.map((p, i) => <p key={i} className="text-sm text-red-600 dark:text-red-400">⚠ {p}</p>)}
            <p className="text-sm">{plan.clientChanges.length} clienti con referente · {plan.userChanges.length} backup · {plan.skippedRows.length} righe saltate.</p>
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {plan.userChanges.map((u) => <li key={u.userId}>{u.userName}: backup → {nameOf(u.backupUserId)} (prima: {nameOf(u.before)})</li>)}
              {plan.clientChanges.map((c) => <li key={c.clientId}>{c.clientName}: referente → {nameOf(c.referenteId)} (prima: {nameOf(c.before.referenteId)})</li>)}
            </ul>
            <button className={btn} disabled={applying || plan.problems.length > 0 || (plan.clientChanges.length + plan.userChanges.length === 0)} onClick={apply}>
              {applying && <Loader2 className="h-4 w-4 animate-spin" />} Salva le assegnazioni
            </button>
            {plan.problems.length > 0 && <p className="text-xs text-muted-foreground">Risolvi gli avvisi in rosso per poter salvare.</p>}
          </section>
        </>
      )}

      <section className="space-y-1">
        <h2 className="text-sm font-medium">Stato attuale</h2>
        <p className="text-xs text-muted-foreground">Clienti senza referente: {unassigned.length} di {clients.length}. Finché non hanno un referente li vedono solo gli amministratori.</p>
        {unassigned.length > 0 && <p className="text-xs text-muted-foreground">{unassigned.map((c) => c.name).join(' · ')}</p>}
        <p className="pt-2 text-xs text-muted-foreground">Backup impostati: {staff.filter((u) => u.backupUserId).map((u) => `${u.name} → ${nameOf(u.backupUserId)}`).join(' · ') || 'nessuno'}</p>
      </section>
    </div>
  )
}
