'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { PublicContent } from '@/lib/content-approval';

/**
 * Approvazione dei post da parte del cliente, raggiungibile col link con token (nessun login).
 * I dati arrivano da /api/share/client/[token]/approvals, che restituisce solo ciò che il cliente può vedere.
 */
export default function ClientApprovalsPage() {
    const token = useParams().token as string;
    const [clientName, setClientName] = useState('');
    const [items, setItems] = useState<PublicContent[] | null>(null);
    const [error, setError] = useState('');
    const [name, setName] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [changesFor, setChangesFor] = useState<string | null>(null);
    const [comment, setComment] = useState('');
    const [message, setMessage] = useState('');

    const load = useCallback(async () => {
        const res = await fetch(`/api/share/client/${encodeURIComponent(token)}/approvals`);
        if (res.status === 404) throw new Error('Questo link non è valido o non è più attivo.');
        if (!res.ok) throw new Error('Non riusciamo a caricare i contenuti. Riprova più tardi.');
        const d = await res.json();
        setClientName(d.clientName);
        setItems(d.items);
    }, [token]);

    useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

    const respond = async (contentId: string, decision: 'approve' | 'changes') => {
        setBusy(contentId);
        setMessage('');
        try {
            const res = await fetch(`/api/share/client/${encodeURIComponent(token)}/approvals`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contentId, decision, comment: decision === 'changes' ? comment : undefined, name }),
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
        <div className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-background p-6 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <h1 className="text-xl font-bold text-foreground">Pagina non disponibile</h1>
            <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
        </div>
    );
    if (!items) return <div className="flex h-screen w-full items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <div className="min-h-screen bg-background px-4 py-8 md:px-10 md:py-12">
            <div className="mx-auto max-w-3xl space-y-6">
                <header>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contenuti da approvare</p>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{clientName}</h1>
                </header>

                <label className="block text-sm text-muted-foreground">
                    Il tuo nome (facoltativo)
                    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}
                        className="mt-1 block w-full rounded-lg border border-border bg-card p-2 text-foreground" />
                </label>

                {message && <p role="status" className="rounded-xl border border-border bg-card p-3 text-sm text-foreground">{message}</p>}

                {items.length === 0 && (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-8 text-center">
                        <CheckCircle2 className="h-8 w-8 text-green-500" />
                        <p className="text-foreground">Non c&apos;è nulla da approvare al momento.</p>
                    </div>
                )}

                {items.map((c) => (
                    <article key={c.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                        <div>
                            <h2 className="text-lg font-bold text-foreground">{c.topic}</h2>
                            <p className="text-xs text-muted-foreground">
                                {[c.format, c.channels.join(', '), c.publicationDate ? `uscita ${new Date(c.publicationDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}` : ''].filter(Boolean).join(' · ')}
                            </p>
                        </div>
                        {c.imageUrls.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto">
                                {c.imageUrls.map((u) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img key={u} src={u} alt="" className="h-48 rounded-lg object-cover" />
                                ))}
                            </div>
                        )}
                        {c.videoUrl && <video src={c.videoUrl} controls className="max-h-72 w-full rounded-lg" />}
                        {c.copy && <p className="whitespace-pre-wrap text-sm text-foreground">{c.copy}</p>}

                        {changesFor === c.id ? (
                            <div className="space-y-2">
                                <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} rows={3} autoFocus
                                    placeholder="Cosa vuoi cambiare?" className="block w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground" />
                                <div className="flex gap-2">
                                    <button disabled={busy === c.id || !comment.trim()} onClick={() => respond(c.id, 'changes')}
                                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Invia richiesta</button>
                                    <button onClick={() => { setChangesFor(null); setComment(''); }} className="rounded-lg px-4 py-2 text-sm text-muted-foreground">Annulla</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <button disabled={busy === c.id} onClick={() => respond(c.id, 'approve')}
                                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Approva</button>
                                <button disabled={busy === c.id} onClick={() => { setChangesFor(c.id); setComment(''); }}
                                    className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground">Chiedi modifiche</button>
                            </div>
                        )}
                    </article>
                ))}

                <footer className="py-6 text-center text-xs text-muted-foreground">&copy; {new Date().getFullYear()} W[r]Digital</footer>
            </div>
        </div>
    );
}
