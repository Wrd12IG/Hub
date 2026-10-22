'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, ExternalLink, Loader2, MessageSquareWarning } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ClientPedItem } from '@/lib/client-ped';

type Tab = 'approve' | 'working' | 'scheduled' | 'published' | 'all';

const TABS: { key: Tab; label: string }[] = [
    { key: 'approve', label: 'Da approvare' },
    { key: 'working', label: 'In lavorazione' },
    { key: 'scheduled', label: 'Programmati' },
    { key: 'published', label: 'Pubblicati' },
    { key: 'all', label: 'Tutti' },
];

function groupOf(i: ClientPedItem): Tab {
    if (i.awaitingClient) return 'approve';
    if (i.status === 'Pubblicato') return 'published';
    if (i.status === 'Bozza') return 'working'; // visibile solo se tornata per le sue modifiche
    return 'scheduled';
}

function formatWhen(v: string | null): string {
    if (!v) return 'Data da definire';
    const d = new Date(v);
    if (isNaN(d.getTime())) return 'Data da definire';
    const day = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    return v.includes('T') ? `${day} · ${d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : day;
}

/**
 * Il PED come lo vede il cliente: i contenuti che il team gli ha mandato, da approvare o chiedere di modificare.
 * Dati dal percorso /api/clients/[id]/ped, che restituisce solo i campi consentiti.
 */
export function ClientPedView({ clientId }: { clientId: string }) {
    const [items, setItems] = useState<ClientPedItem[] | null>(null);
    const [error, setError] = useState('');
    const [tab, setTab] = useState<Tab>('approve');
    const [busy, setBusy] = useState<string | null>(null);
    const [changesFor, setChangesFor] = useState<string | null>(null);
    const [comment, setComment] = useState('');
    const [message, setMessage] = useState('');

    const load = useCallback(async () => {
        const res = await fetch(`/api/clients/${clientId}/ped`);
        if (!res.ok) throw new Error('Non riusciamo a caricare i contenuti. Riprova più tardi.');
        const d = await res.json();
        setItems(d.items);
    }, [clientId]);

    useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

    const counts = useMemo(() => {
        const c: Record<Tab, number> = { approve: 0, working: 0, scheduled: 0, published: 0, all: items?.length || 0 };
        (items || []).forEach((i) => { c[groupOf(i)]++; });
        return c;
    }, [items]);

    // All'apertura, se non c'è nulla da approvare, si parte da "Tutti" invece che da una pagina vuota
    useEffect(() => { if (items && counts.approve === 0 && tab === 'approve') setTab('all'); }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

    const visible = useMemo(() => (items || []).filter((i) => tab === 'all' || groupOf(i) === tab), [items, tab]);

    const respond = async (id: string, decision: 'approve' | 'changes') => {
        setBusy(id);
        setMessage('');
        try {
            const res = await fetch(`/api/clients/${clientId}/ped/${id}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision, comment: decision === 'changes' ? comment : undefined }),
            });
            const d = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(d.error || 'Non siamo riusciti a registrare la risposta.');
            setMessage(decision === 'approve' ? 'Approvato, grazie!' : 'Richiesta di modifiche inviata, grazie!');
            setChangesFor(null);
            setComment('');
            await load();
        } catch (e: any) {
            setMessage(e.message);
        } finally {
            setBusy(null);
        }
    };

    if (error) return (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-10 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
        </div>
    );
    if (!items) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <header>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Piano editoriale</p>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">I tuoi contenuti</h1>
                <p className="mt-1 text-sm text-muted-foreground">Approva i contenuti che il team ti propone, oppure chiedi di modificarli.</p>
            </header>

            <div role="tablist" className="flex flex-wrap gap-2">
                {TABS.map((t) => (
                    <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                        className={cn('rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                            tab === t.key ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted')}>
                        {t.label}
                        <span className={cn('ml-2 rounded-full px-1.5 text-xs', tab === t.key ? 'bg-primary-foreground/20' : 'bg-muted')}>{counts[t.key]}</span>
                    </button>
                ))}
            </div>

            {message && <p role="status" className="rounded-xl border bg-card p-3 text-sm text-foreground">{message}</p>}

            {visible.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-10 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                    <p className="text-foreground">{tab === 'approve' ? 'Non c’è nulla da approvare al momento.' : 'Nessun contenuto in questa sezione.'}</p>
                </div>
            )}

            {visible.map((c) => (
                <article key={c.id} className={cn('space-y-3 rounded-xl border bg-card p-4', c.awaitingClient && 'border-primary/50 shadow-sm')}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                            <h2 className="text-lg font-bold text-foreground">{c.topic}</h2>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatWhen(c.publicationDate)}</span>
                                {c.format && <span>{c.format}</span>}
                                {c.channels.length > 0 && <span>{c.channels.join(', ')}</span>}
                            </p>
                        </div>
                        <Badge variant={c.awaitingClient ? 'default' : 'secondary'}>
                            {c.awaitingClient ? 'Da approvare' : c.status === 'Pubblicato' ? 'Pubblicato' : c.status === 'Bozza' ? 'Modifiche in lavorazione' : 'Approvato'}
                        </Badge>
                    </div>

                    {(c.imageUrls.length > 0 || c.videoUrl) && (
                        <div className="flex gap-2 overflow-x-auto">
                            {c.imageUrls.map((u) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img key={u} src={u} alt="" className="h-48 rounded-lg object-cover" />
                            ))}
                            {c.videoUrl && <video src={`${c.videoUrl}#t=0.1`} poster={c.coverUrl || undefined} controls preload="metadata" playsInline className="max-h-72 rounded-lg" />}
                        </div>
                    )}

                    {c.copy && <p className="whitespace-pre-wrap text-sm text-foreground">{c.copy}</p>}
                    {(c.mentions || c.hashtags) && <p className="text-xs text-muted-foreground">{[c.mentions, c.hashtags].filter(Boolean).join('  ')}</p>}
                    {c.storyLink && <p className="text-xs text-muted-foreground">Link della storia: {c.storyLink}</p>}

                    {c.approval?.status === 'changes' && c.approval.comment && (
                        <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                            <MessageSquareWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>Hai chiesto modifiche: «{c.approval.comment}»</span>
                        </p>
                    )}

                    {c.published.length > 0 && (
                        <p className="flex flex-wrap gap-3 text-xs">
                            {c.published.map((p) => p.url
                                ? <a key={p.channel} href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink className="h-3 w-3" />{p.channel}</a>
                                : <span key={p.channel} className="text-muted-foreground">{p.channel}</span>)}
                        </p>
                    )}

                    {c.awaitingClient && (changesFor === c.id ? (
                        <div className="space-y-2">
                            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} autoFocus placeholder="Cosa vuoi cambiare?" />
                            <div className="flex gap-2">
                                <Button disabled={busy === c.id || !comment.trim()} onClick={() => respond(c.id, 'changes')}>Invia richiesta</Button>
                                <Button variant="ghost" onClick={() => { setChangesFor(null); setComment(''); }}>Annulla</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <Button disabled={busy === c.id} onClick={() => respond(c.id, 'approve')} className="bg-green-600 text-white hover:bg-green-700">
                                {busy === c.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Approva
                            </Button>
                            <Button variant="outline" disabled={busy === c.id} onClick={() => { setChangesFor(c.id); setComment(''); }}>Chiedi modifiche</Button>
                        </div>
                    ))}
                </article>
            ))}
        </div>
    );
}
