'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, MessageSquareWarning, Hourglass } from 'lucide-react';
import { useLayoutData } from '@/app/(app)/layout-context';
import { getEditorialContentsNeedingAttention } from '@/lib/actions';
import { approvalBoard, type BoardItem } from '@/lib/approval-board';
import type { EditorialContent } from '@/lib/data';
import { EditorialSectionNav } from '@/components/editorial-section-nav';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ALL = 'all';

function when(v?: string): string {
    const d = v ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : 'data da definire';
}

function Row({ item, clientName, showClient }: { item: BoardItem; clientName: string; showClient: boolean }) {
    const c = item.content;
    return (
        <li>
            <Link href={`/clients/${c.clientId}/editorial-plan`} className="block rounded-xl border bg-card p-3 transition-colors hover:bg-muted/50">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-foreground">{c.topic || 'Contenuto senza titolo'}</span>
                    <span className="text-xs text-muted-foreground">
                        {item.daysWaiting === 0 ? 'da oggi' : item.daysWaiting === 1 ? 'da 1 giorno' : `da ${item.daysWaiting} giorni`}
                    </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                    {showClient && <><b className="font-semibold text-foreground/80">{clientName}</b> · </>}
                    {[c.format, `esce il ${when(c.publicationDate)}`].filter(Boolean).join(' · ')}
                </p>
                {c.approval?.status === 'changes' && c.approval.comment && (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-amber-500/10 p-2 text-sm text-foreground">
                        {c.approval.respondedBy ? <b>{c.approval.respondedBy}: </b> : null}{c.approval.comment}
                    </p>
                )}
            </Link>
        </li>
    );
}

function Section({ icon: Icon, title, hint, items, clientsById, showClient }: {
    icon: React.ElementType; title: string; hint: string; items: BoardItem[]; clientsById: Record<string, { name?: string }>; showClient: boolean;
}) {
    return (
        <section className="space-y-2">
            <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                    <Icon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />{title}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{items.length}</span>
                </h2>
                <p className="text-sm text-muted-foreground">{hint}</p>
            </div>
            {items.length === 0
                ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Niente qui.</p>
                : <ul className="space-y-2">{items.map((i) => <Row key={i.content.id} item={i} clientName={clientsById[i.content.clientId]?.name || 'Cliente'} showClient={showClient} />)}</ul>}
        </section>
    );
}

function ApprovalsContent() {
    const { activeClients, clientsById } = useLayoutData();
    const router = useRouter();
    const params = useSearchParams();
    const clientId = params.get('cliente');
    const [contents, setContents] = useState<EditorialContent[] | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getEditorialContentsNeedingAttention()
            .then((c) => { if (!cancelled) setContents(c); })
            .catch(() => { if (!cancelled) setError(true); });
        return () => { cancelled = true; };
    }, []);

    const board = useMemo(() => {
        if (!contents) return null;
        // Solo i clienti che l'utente vede e non archiviati
        const visible = new Set(activeClients.map((c) => c.id));
        return approvalBoard(contents.filter((c) => visible.has(c.clientId)), new Date(), clientId);
    }, [contents, activeClients, clientId]);

    const sorted = useMemo(() => [...activeClients].sort((a, b) => (a.name || '').localeCompare(b.name || '')), [activeClients]);

    return (
        <div className="mx-auto w-full max-w-4xl space-y-6">
            <header className="space-y-3">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Piano Editoriale</h1>
                    <p className="text-muted-foreground">Cosa aspetta il cliente e cosa ci ha rimandato indietro.</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <EditorialSectionNav clientId={clientId} />
                    <Select value={clientId || ALL} onValueChange={(v) => router.replace(v === ALL ? '/editorial-plan/approvazioni' : `/editorial-plan/approvazioni?cliente=${encodeURIComponent(v)}`)}>
                        <SelectTrigger className="w-56" aria-label="Filtra per cliente"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>Tutti i clienti</SelectItem>
                            {sorted.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </header>

            {error && <p role="alert" className="rounded-xl border p-4 text-sm text-muted-foreground">Non riesco a caricare le approvazioni. Riprova tra poco.</p>}
            {!error && !board && <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}

            {board && board.changes.length + board.waiting.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-10 text-center">
                    <CheckCircle2 className="h-8 w-8 text-green-500" aria-hidden="true" />
                    <p className="text-foreground">Nessuna approvazione in sospeso{clientId ? ' per questo cliente' : ''}.</p>
                </div>
            )}

            {board && board.changes.length + board.waiting.length > 0 && (
                <>
                    <Section icon={MessageSquareWarning} title="Il cliente ha chiesto modifiche" hint="Tocca a noi: correggere e rimandare in approvazione."
                        items={board.changes} clientsById={clientsById} showClient={!clientId} />
                    <Section icon={Hourglass} title="In attesa del cliente" hint="Mandati e senza risposta, i più fermi per primi."
                        items={board.waiting} clientsById={clientsById} showClient={!clientId} />
                </>
            )}
        </div>
    );
}

export default function EditorialApprovalsPage() {
    return (
        <Suspense fallback={<div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
            <ApprovalsContent />
        </Suspense>
    );
}
