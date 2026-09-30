"use client"

import React from 'react'
import { HealthFace, fmtChip } from '@/components/ClientHealthBadge'
import type { HealthState } from '@/lib/client-health'

/**
 * Il badge di salute nella lista dei clienti: 28px, senza chip, non
 * cliccabile.
 *
 * Tre scelte che lo distinguono da quello nella pagina cliente:
 *
 * - **Senza chip.** In una griglia di sessanta card il numero diventa rumore:
 *   lì serve scorrere l'occhio e vedere dove c'è rosso. Il numero lo si legge
 *   aprendo.
 * - **Non cliccabile.** La card è già un link al cliente. Un popover dentro un
 *   link fa sparire la pagina appena provi ad aprirlo, o apre due cose insieme.
 *   Il perché sta nel badge grande, un click più in là.
 * - **Il titolo distingue due grigi.** "Dati insufficienti" e "mai calcolato"
 *   hanno la stessa faccia vuota ma non sono la stessa cosa, e sul secondo
 *   basta aprire il cliente per risolverlo.
 */

export interface ClientHealthRow {
    clientId: string
    state: HealthState | null
    deltaPct: number | null
    deltaAbs: number | null
    deltaKind: 'pct' | 'abs' | null
    metricLabel: string | null
    computedAt: string | null
    cached: boolean
}

const LABEL: Record<HealthState, string> = {
    up: 'In crescita',
    flat: 'Stabile',
    down: 'In calo',
    unknown: 'Dati insufficienti',
}

export function ClientHealthDot({ row }: { row?: ClientHealthRow }) {
    if (!row?.cached || !row.state) {
        return (
            <span
                title="Andamento non ancora calcolato — apri il cliente per vederlo"
                aria-label="Andamento non ancora calcolato"
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-white/15"
            >
                <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
            </span>
        )
    }

    const delta = row.state === 'unknown' ? null : fmtChip(row)
    const title =
        row.state === 'unknown'
            ? 'Dati insufficienti per un verdetto'
            : `${LABEL[row.state]}${delta ? ` · ${delta}` : ''}${row.metricLabel ? ` ${row.metricLabel}` : ''} vs 30 gg precedenti`

    return (
        <span title={title} className="inline-flex shrink-0">
            <HealthFace state={row.state} size={28} showChip={false} />
        </span>
    )
}
