'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { ClientPublicReport } from '@/components/ClientPublicReport';
import type { PublicClientReport } from '@/lib/client-report-public';

/**
 * Pagina pubblica del cliente, raggiungibile col link con token. Niente login e niente Firestore dal browser:
 * i dati arrivano da /api/share/client/[token]/report, che restituisce solo ciò che il cliente può vedere.
 */
export default function ClientSharePage() {
    const token = useParams().token as string;
    const [days, setDays] = useState(30);
    const [data, setData] = useState<PublicClientReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetch(`/api/share/client/${encodeURIComponent(token)}/report?days=${days}`)
            .then(async (res) => {
                if (res.status === 404) throw new Error('Questo link non è valido o non è più attivo.');
                if (!res.ok) throw new Error('I risultati non sono disponibili al momento. Riprova più tardi.');
                return res.json();
            })
            .then((d) => { if (!cancelled) { setData(d); setError(''); } })
            .catch((e) => { if (!cancelled) setError(e.message); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [token, days]);

    if (error && !data) return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <h1 className="text-xl font-bold text-foreground">Pagina non disponibile</h1>
            <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
        </div>
    );

    if (!data) return <div className="flex h-screen w-full items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <div className="min-h-screen bg-background px-4 py-8 md:px-10 md:py-12">
            <div className="mx-auto max-w-4xl space-y-8">
                <header>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Report marketing</p>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{data.clientName}</h1>
                </header>

                {error && <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">{error}</p>}
                <ClientPublicReport data={data} days={days} onChangeDays={setDays} loading={loading} />

                <footer className="py-6 text-center text-xs text-muted-foreground">
                    {data.updatedAt && <p>Dati aggiornati il {new Date(data.updatedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>}
                    <p>&copy; {new Date().getFullYear()} W[r]Digital</p>
                </footer>
            </div>
        </div>
    );
}
