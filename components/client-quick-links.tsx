'use client';

import React from 'react';
import Link from 'next/link';
import { CalendarDays, CheckCircle2, FileText, Gauge, ImageIcon, LayoutGrid, Search, Sparkles, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clientQuickLinks, type QuickLinkKey } from '@/lib/client-quick-links';

const ICON: Record<QuickLinkKey, React.ElementType> = {
    piano: CalendarDays,
    tasks: CheckCircle2,
    progetti: LayoutGrid,
    creative: Sparkles,
    scheda: FileText,
    kpi: Gauge,
    monitor: Search,
    board: ImageIcon,
    growth: TrendingUp,
};

/**
 * I collegamenti rapidi in cima alla scheda di un cliente. Solo per lo staff: chi chiama non lo monta per il ruolo Cliente.
 * Raggruppati per intenzione (lavoro sul cliente, creatività e sito, analisi), con un divisore tra un gruppo e l'altro.
 */
export function ClientQuickLinks({ clientId, kpiProfile }: { clientId: string; kpiProfile?: string | null }) {
    const links = clientQuickLinks(clientId, kpiProfile);
    return (
        <div className="relative z-20 flex flex-wrap items-center gap-2.5 bg-muted/40 border border-border p-4 rounded-2xl shadow-sm">
            {links.map((l, i) => {
                const Icon = ICON[l.key];
                const startsNewGroup = i > 0 && l.group !== links[i - 1].group;
                return (
                    <React.Fragment key={l.key}>
                        {startsNewGroup && <span aria-hidden className="h-6 w-px bg-muted mx-1" />}
                        <Link
                            href={l.href}
                            className="relative z-10 cursor-pointer inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-border bg-muted/40 hover:bg-muted hover:border-foreground/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 active:scale-95 text-foreground"
                        >
                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', l.dot)} />
                            <Icon className="h-3.5 w-3.5 text-muted-foreground/80" />
                            {l.label}
                        </Link>
                    </React.Fragment>
                );
            })}
        </div>
    );
}
