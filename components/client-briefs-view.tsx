'use client';

import { authFetch } from '@/lib/client-api-auth';
import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface BriefItem { id: string; title: string; status: string; deadline: string | null; createdAt: string | null; request: string }

const STATUS_LABEL: Record<string, string> = {
    Bozza: 'In preparazione', Inviato: 'Inviato', 'In Revisione': 'Il team lo sta valutando', Approvato: 'Preso in carico',
};

/** I brief del cliente: richiesta di una nuova lavorazione e stato di quelle già inviate. */
export function ClientBriefsView({ clientId }: { clientId: string }) {
    const [items, setItems] = useState<BriefItem[] | null>(null);
    const [error, setError] = useState('');
    const [title, setTitle] = useState('');
    const [request, setRequest] = useState('');
    const [deadline, setDeadline] = useState('');
    const [references, setReferences] = useState('');
    const [sending, setSending] = useState(false);
    const [message, setMessage] = useState('');

    const load = useCallback(async () => {
        const res = await authFetch(`/api/clients/${clientId}/briefs`);
        if (!res.ok) throw new Error('Non riusciamo a caricare le richieste. Riprova più tardi.');
        setItems((await res.json()).items);
    }, [clientId]);

    useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);
        setMessage('');
        try {
            const res = await authFetch(`/api/clients/${clientId}/briefs`, {
                method: 'POST',
                body: JSON.stringify({ title, request, deadline: deadline || undefined, references: references || undefined }),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(d.error || 'Non siamo riusciti a inviare la richiesta.');
            setMessage('Richiesta inviata: il team la prenderà in carico.');
            setTitle(''); setRequest(''); setDeadline(''); setReferences('');
            await load();
        } catch (err: any) {
            setMessage(err.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="mx-auto max-w-3xl space-y-8">
            <header>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Brief</p>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Richiedi una lavorazione</h1>
                <p className="mt-1 text-sm text-muted-foreground">Descrivi cosa ti serve: il team valuta la richiesta e la prende in carico.</p>
            </header>

            <form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4">
                <div className="space-y-1.5">
                    <Label htmlFor="brief-title">Titolo</Label>
                    <Input id="brief-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="Es. Video di presentazione nuova gamma" />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="brief-request">Cosa ti serve</Label>
                    <Textarea id="brief-request" value={request} onChange={(e) => setRequest(e.target.value)} maxLength={4000} rows={5} required placeholder="Obiettivo, a chi è rivolto, messaggi da comunicare…" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="brief-deadline">Entro quando (facoltativo)</Label>
                        <Input id="brief-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="brief-refs">Esempi o riferimenti (facoltativo)</Label>
                        <Input id="brief-refs" value={references} onChange={(e) => setReferences(e.target.value)} maxLength={4000} placeholder="Link a esempi che ti piacciono" />
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button type="submit" disabled={sending || !title.trim() || !request.trim()}>
                        {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Invia richiesta
                    </Button>
                    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
                </div>
            </form>

            <section className="space-y-3">
                <h2 className="text-lg font-bold text-foreground">Le tue richieste</h2>
                {error && <p className="flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="h-4 w-4" />{error}</p>}
                {!items && !error && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
                {items && items.length === 0 && <p className="text-sm text-muted-foreground">Non hai ancora inviato richieste.</p>}
                {items?.map((b) => (
                    <article key={b.id} className="rounded-xl border bg-card p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="font-semibold text-foreground">{b.title}</h3>
                            <Badge variant="secondary">{STATUS_LABEL[b.status] || b.status}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {b.createdAt ? `Inviata il ${new Date(b.createdAt).toLocaleDateString('it-IT')}` : ''}
                            {b.deadline ? ` · entro il ${new Date(b.deadline).toLocaleDateString('it-IT')}` : ''}
                        </p>
                        {b.request && <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-foreground">{b.request}</p>}
                    </article>
                ))}
            </section>
        </div>
    );
}
