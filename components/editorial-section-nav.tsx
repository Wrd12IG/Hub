'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { activeEditorialTab, editorialTabs } from '@/lib/editorial-nav';

/**
 * La barra comune delle pagine del Piano editoriale (Calendario, Genera con AI, Importa, Approvazioni).
 * Sono pagine vere, non schede dello stesso schermo: così ognuna ha il suo indirizzo e il tasto «indietro» funziona.
 */
export function EditorialSectionNav({ clientId, className }: { clientId?: string | null; className?: string }) {
    const pathname = usePathname();
    const active = activeEditorialTab(pathname);
    return (
        <nav aria-label="Sezioni del Piano editoriale" className={cn('flex flex-wrap gap-1 rounded-xl border bg-muted/40 p-1', className)}>
            {editorialTabs(clientId).map((t) => {
                const base = 'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors';
                if (!t.href) {
                    return (
                        <span key={t.key} aria-disabled="true" title={t.hint} className={cn(base, 'cursor-not-allowed text-muted-foreground/50')}>
                            {t.label}
                        </span>
                    );
                }
                return (
                    <Link
                        key={t.key}
                        href={t.href}
                        aria-current={active === t.key ? 'page' : undefined}
                        className={cn(base, active === t.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:bg-background/60 hover:text-foreground')}
                    >
                        {t.label}
                    </Link>
                );
            })}
        </nav>
    );
}
