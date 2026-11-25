'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarCheck } from 'lucide-react';
import { useClientTodo } from '@/hooks/use-client-todo';

/**
 * «Cosa devi fare tu», in cima ai risultati dell'accesso Cliente. Appare solo se c'è qualcosa da fare:
 * quando non c'è nulla non occupa spazio e non dà l'impressione di un compito sempre aperto.
 */
export function ClientTodoCard({ clientId }: { clientId: string }) {
    const { toApprove } = useClientTodo(clientId);
    if (!toApprove) return null;

    return (
        <Link
            href={`/clients/${clientId}/editorial-plan`}
            className="flex items-center gap-4 rounded-2xl border border-primary/40 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
        >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <CalendarCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Cosa devi fare tu</span>
                <span className="block font-bold text-foreground">
                    {toApprove === 1 ? 'Hai 1 contenuto da approvare' : `Hai ${toApprove} contenuti da approvare`}
                </span>
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Vai al piano <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
        </Link>
    );
}
