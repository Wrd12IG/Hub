'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Sezione della scheda cliente: stessa testata per tutte (icona, titolo, descrizione, riepilogo a destra,
 * freccia) e chiusa all'apertura della pagina.
 *
 * Il contenuto viene montato alla prima apertura e poi resta montato (nascosto): le sezioni che caricano
 * dati non partono finché non servono, e richiudere/riaprire non rifà il caricamento.
 */
export function CollapsibleCard({
    title, description, icon: Icon, summary, actions, defaultOpen = false, className, children,
}: {
    title: ReactNode
    description?: ReactNode
    icon?: LucideIcon
    /** Valore sempre visibile a sezione chiusa (punteggio, stato…). */
    summary?: ReactNode
    /** Comandi della sezione (modifica, aggiorna…): non aprono né chiudono. */
    actions?: ReactNode
    defaultOpen?: boolean
    className?: string
    children: ReactNode
}) {
    const [open, setOpen] = useState(defaultOpen)
    const [everOpened, setEverOpened] = useState(defaultOpen)

    const toggle = () => {
        setOpen((o) => !o)
        setEverOpened(true)
    }

    return (
        <section className={cn('glass-card rounded-2xl border border-white/10 bg-white/[0.03] shadow-md', className)}>
            <div className="flex items-center gap-3 p-5 sm:p-6">
                <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                    {Icon && (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                        </span>
                    )}
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-extrabold tracking-tight text-foreground">{title}</span>
                        {description && <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>}
                    </span>
                    {summary && <span className="shrink-0 text-right">{summary}</span>}
                </button>
                {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                <button
                    type="button"
                    onClick={toggle}
                    aria-label={open ? 'Chiudi sezione' : 'Apri sezione'}
                    tabIndex={-1}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground transition-colors cursor-pointer"
                >
                    <ChevronDown className={cn('h-5 w-5 transition-transform duration-200', open && 'rotate-180')} />
                </button>
            </div>
            {everOpened && (
                <div hidden={!open} className="space-y-6 px-5 pb-5 sm:px-6 sm:pb-6">
                    {children}
                </div>
            )}
        </section>
    )
}
