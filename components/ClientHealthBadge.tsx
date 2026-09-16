"use client"

import React, { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { adsSetupReason, type ClientHealth, type HealthReason, type HealthState } from '@/lib/client-health'

/**
 * Il badge accanto al nome del cliente.
 *
 * La faccia è disegnata a mano e non è un'emoji di sistema: la differenza sta
 * quasi tutta nelle sopracciglia. Un arco all'ingiù da solo legge "triste",
 * le sopracciglia inclinate leggono "c'è un problema" — che è il messaggio.
 *
 * Lo stato "dati insufficienti" è vuoto e tratteggiato, non grigio pieno: non
 * deve sembrare un quarto voto, deve sembrare un buco.
 *
 * Cosa significa il voto e perché guarda solo il risultato: lib/client-health.ts.
 */

/**
 * Verde e rosso sono ovvi. Il neutro era ambra e stonava per due motivi: a
 * 48px accanto a un nome in nero diventava marrone, e soprattutto l'ambra
 * significa "attenzione" — mentre "stabile" non è un allarme, è uno stato
 * noto senza variazioni. Il blu lo dice senza inventare un problema, e resta
 * distinguibile dal grigio tratteggiato di "dati insufficienti" perché quello
 * è vuoto, non pieno.
 */
const TONE: Record<HealthState, { fill: string; on: string }> = {
    up: { fill: '#059669', on: '#ffffff' },
    flat: { fill: '#2563eb', on: '#ffffff' },
    down: { fill: '#dc2626', on: '#ffffff' },
    unknown: { fill: 'none', on: '#94a3b8' },
}

const HEADLINE: Record<HealthState, string> = {
    up: 'In crescita',
    flat: 'Stabile',
    down: 'In calo',
    unknown: 'Dati insufficienti',
}

const DOT: Record<HealthReason['tone'], string> = {
    good: 'bg-emerald-400',
    warn: 'bg-amber-400',
    bad: 'bg-red-400',
    neutral: 'bg-white/30',
}

/**
 * L'etichetta del chip. Il segno meno è quello tipografico (−), non il
 * trattino della tastiera.
 *
 * Due letture possibili: la percentuale nel caso normale, la differenza
 * assoluta quando la base precedente è troppo piccola perché una percentuale
 * significhi qualcosa (3 → 184 conversioni mostra "+181", non "+6.033%").
 */
export function fmtChip(h: { deltaPct?: number | null; deltaAbs?: number | null; deltaKind?: 'pct' | 'abs' | null }): string {
    const sign = (v: number) => (v < 0 ? '−' : '+')
    if (h.deltaKind === 'abs' && typeof h.deltaAbs === 'number') {
        const n = Math.round(Math.abs(h.deltaAbs))
        return `${sign(h.deltaAbs)}${new Intl.NumberFormat('it-IT').format(n)}`
    }
    if (typeof h.deltaPct === 'number') {
        const a = Math.abs(h.deltaPct)
        const n = a >= 10 ? Math.round(a) : a
        return `${sign(h.deltaPct)}${String(n).replace('.', ',')}%`
    }
    return 'n/d'
}

function Features({ state, on }: { state: HealthState; on: string }) {
    if (state === 'up')
        return (
            <>
                <circle cx="17" cy="19.5" r="2.7" fill={on} />
                <circle cx="31" cy="19.5" r="2.7" fill={on} />
                <path d="M13.5 27.5 Q24 37.5 34.5 27.5" fill="none" stroke={on} strokeWidth="3.4" strokeLinecap="round" />
            </>
        )
    if (state === 'flat')
        return (
            <>
                <circle cx="17" cy="20" r="2.7" fill={on} />
                <circle cx="31" cy="20" r="2.7" fill={on} />
                <path d="M14 31 H34" fill="none" stroke={on} strokeWidth="3.4" strokeLinecap="round" />
            </>
        )
    if (state === 'down')
        return (
            <>
                <path d="M12.5 15.5 L20 19.5" fill="none" stroke={on} strokeWidth="3" strokeLinecap="round" />
                <path d="M35.5 15.5 L28 19.5" fill="none" stroke={on} strokeWidth="3" strokeLinecap="round" />
                <circle cx="17" cy="23.5" r="2.6" fill={on} />
                <circle cx="31" cy="23.5" r="2.6" fill={on} />
                <path d="M14.5 34.5 Q24 27 33.5 34.5" fill="none" stroke={on} strokeWidth="3.4" strokeLinecap="round" />
            </>
        )
    return (
        <>
            <path d="M14 21 H19.5" fill="none" stroke={on} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M28.5 21 H34" fill="none" stroke={on} strokeWidth="2.6" strokeLinecap="round" />
            <path d="M15.5 31 H32.5" fill="none" stroke={on} strokeWidth="2.6" strokeLinecap="round" strokeDasharray="3 4" />
        </>
    )
}

/**
 * La faccia, esportata a parte perché serve in due misure: 48px con il chip
 * del delta sulla pagina cliente, 28px senza chip nella lista dei clienti —
 * in una lista densa il chip è rumore, lì serve solo scorrere e vedere i rossi.
 */
export function HealthFace({
    state,
    chip = null,
    size = 48,
    showChip = true,
}: {
    state: HealthState
    /** Etichetta del chip, già formattata da fmtChip. */
    chip?: string | null
    size?: number
    showChip?: boolean
}) {
    const t = TONE[state]
    const h = showChip ? Math.round((size * 56) / 48) : size
    const chipFill = state === 'unknown' ? 'rgba(148,163,184,0.18)' : t.fill
    const chipText = state === 'unknown' ? '#94a3b8' : t.on
    const text = chip ?? 'n/d'
    const label = `${HEADLINE[state]}${chip ? `, ${chip}` : ''}`

    return (
        <svg
            viewBox={showChip ? '0 0 48 56' : '0 0 48 48'}
            width={size}
            height={h}
            role="img"
            aria-label={label}
            className="shrink-0 overflow-visible"
        >
            {state === 'unknown' ? (
                <circle cx="24" cy="24" r="21" fill="none" stroke="#475569" strokeWidth="2" strokeDasharray="4 4" />
            ) : (
                <circle cx="24" cy="24" r="22" fill={t.fill} />
            )}
            <Features state={state} on={t.on} />
            {showChip && (
                <>
                    <rect
                        x="3"
                        y="35"
                        width="42"
                        height="19"
                        rx="9.5"
                        fill={chipFill}
                        stroke="hsl(var(--background))"
                        strokeWidth="2.5"
                    />
                    <text
                        x="24"
                        y="48.5"
                        fontSize={text.length > 5 ? '9.5' : '10.5'}
                        fontWeight="800"
                        fill={chipText}
                        textAnchor="middle"
                        fontFamily="inherit"
                    >
                        {text}
                    </text>
                </>
            )}
        </svg>
    )
}

type Payload = ClientHealth & { computedAt?: string; cached?: boolean; error?: string }

export function ClientHealthBadge({
    clientId,
    adsHealthOverall,
}: {
    clientId: string
    /**
     * Lo Health Score Ads lo passa la pagina: ce l'ha già in memoria dalle
     * campagne del tab Campagne, mentre alla route costerebbe un altro giro su
     * Windsor (~13s) per lo stesso numero.
     */
    adsHealthOverall?: number | null
}) {
    const [data, setData] = useState<Payload | null>(null)
    const [loading, setLoading] = useState(true)

    const load = useCallback(
        async (refresh = false) => {
            setLoading(true)
            try {
                const token = localStorage.getItem('token')
                const res = await fetch(`/api/clients/${clientId}/health${refresh ? '?refresh=1' : ''}`, {
                    headers: { Authorization: `Bearer ${token}` },
                })
                const j = await res.json()
                setData(j)
            } catch (err: any) {
                setData({ error: err?.message ?? 'Richiesta fallita' } as Payload)
            } finally {
                setLoading(false)
            }
        },
        [clientId]
    )

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            if (!cancelled) await load(false)
        })()
        return () => {
            cancelled = true
        }
    }, [load])

    if (loading && !data) {
        return (
            <div
                className="h-12 w-12 shrink-0 animate-pulse rounded-full border-2 border-dashed border-white/10"
                aria-label="Calcolo dell'andamento in corso"
            />
        )
    }
    if (!data) return null

    const state: HealthState = data.error ? 'unknown' : data.state ?? 'unknown'
    const blocked = data.error ?? data.blocked ?? null

    // Il Setup Ads entra qui, subito dopo l'andamento: la route non lo calcola.
    const reasons: HealthReason[] = [...(data.reasons ?? [])]
    if (typeof adsHealthOverall === 'number' && !reasons.some((r) => r.id === 'ads_setup')) {
        const at = reasons.findIndex((r) => r.id === 'trend')
        reasons.splice(at >= 0 ? at + 1 : 0, 0, adsSetupReason(adsHealthOverall))
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    aria-label={`Andamento del cliente: ${HEADLINE[state]}. Apri il dettaglio.`}
                >
                    <HealthFace state={state} chip={state === 'unknown' ? null : fmtChip(data)} size={48} />
                </button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-[22rem] border-white/10 bg-card p-0">
                <div className="flex items-start gap-3 border-b border-white/10 p-4">
                    <HealthFace state={state} size={40} showChip={false} />
                    <div className="min-w-0">
                        <p className="text-sm font-black leading-tight text-foreground">{HEADLINE[state]}</p>
                        {state !== 'unknown' && data.metricLabel && (
                            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                                {fmtChip(data)} {data.metricLabel} {data.periodLabel}
                            </p>
                        )}
                        {blocked && <p className="mt-1 text-xs leading-snug text-muted-foreground">{blocked}</p>}
                    </div>
                </div>

                {reasons.length > 0 && (
                    <ul className="divide-y divide-white/5">
                        {reasons.map((r) => (
                            <li key={r.id} className="flex gap-2.5 p-4">
                                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[r.tone]}`} />
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-foreground">{r.label}</p>
                                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{r.detail}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="flex items-center justify-between gap-2 border-t border-white/10 px-4 py-2.5">
                    <span className="text-[10px] text-muted-foreground">
                        {data.computedAt
                            ? `Calcolato il ${new Date(data.computedAt).toLocaleString('it-IT', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                              })}`
                            : ''}
                    </span>
                    <button
                        type="button"
                        onClick={() => load(true)}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                    >
                        <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                        Ricalcola
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
