'use client';

import { useEffect, useState } from 'react';
import { authFetch } from '@/lib/client-api-auth';

/**
 * Quante cose aspettano il cliente: oggi i contenuti del PED da approvare.
 * Si rilegge a ogni cambio di pagina, così dopo un'approvazione il numero scende senza ricaricare.
 * `null` finché non è noto (o se la richiesta fallisce): meglio nessun numero che un numero sbagliato.
 */
export function useClientTodo(clientId: string | null | undefined, refreshKey?: string): { toApprove: number | null } {
    const [toApprove, setToApprove] = useState<number | null>(null);

    useEffect(() => {
        if (!clientId) { setToApprove(null); return; }
        let cancelled = false;
        authFetch(`/api/clients/${clientId}/ped`)
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
            .then((d: { items?: { awaitingClient?: boolean }[] }) => {
                if (!cancelled) setToApprove((d.items || []).filter((i) => i.awaitingClient).length);
            })
            .catch(() => { if (!cancelled) setToApprove(null); });
        return () => { cancelled = true; };
    }, [clientId, refreshKey]);

    return { toApprove };
}
