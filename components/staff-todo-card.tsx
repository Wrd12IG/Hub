'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BookOpen, CalendarCheck } from 'lucide-react';
import { useLayoutData } from '@/app/(app)/layout-context';
import { getBriefs, getEditorialContentsNeedingAttention } from '@/lib/actions';
import { staffTodo } from '@/lib/staff-todo';
import type { Brief, EditorialContent } from '@/lib/data';

const MAX_PER_GROUP = 4;

interface Row { key: string; href: string; client: string; text: string; urgent?: boolean }

/**
 * «Da chiudere oggi»: i brief e i contenuti del PED che aspettano lo staff. Sta in cima alla dashboard e sparisce quando
 * non c'è nulla: un riquadro sempre pieno finirebbe per non essere letto.
 */
export function StaffTodoCard() {
    const { activeClients, clientsById } = useLayoutData();
    const [briefs, setBriefs] = useState<Brief[] | null>(null);
    const [contents, setContents] = useState<EditorialContent[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        // Due letture indipendenti: se una fallisce l'altra si mostra lo stesso
        getBriefs().then((b) => { if (!cancelled) setBriefs(b); }).catch(() => { if (!cancelled) setBriefs([]); });
        getEditorialContentsNeedingAttention().then((c) => { if (!cancelled) setContents(c); }).catch(() => { if (!cancelled) setContents([]); });
        return () => { cancelled = true; };
    }, []);

    const groups = useMemo(() => {
        if (!briefs || !contents) return null;
        // Solo i clienti che l'utente vede e che non sono archiviati
        const visible = new Set(activeClients.map((c) => c.id));
        const todo = staffTodo({ briefs: briefs.filter((b) => visible.has(b.clientId)), contents: contents.filter((c) => visible.has(c.clientId)), now: new Date() });
        const name = (id: string) => clientsById[id]?.name || 'Cliente';
        const overdueIds = new Set(todo.briefs.overdue.map((b) => b.id));
        const briefRow = (b: Brief, text: string): Row => ({ key: `b-${b.id}`, href: '/briefs', client: name(b.clientId), text: `${b.title || b.projectName} — ${text}`, urgent: overdueIds.has(b.id) });
        const pedRow = (c: EditorialContent, text: string): Row => ({ key: `c-${c.id}`, href: `/clients/${c.clientId}/editorial-plan`, client: name(c.clientId), text: `${c.topic || 'Contenuto'} — ${text}` });
        return {
            total: todo.total,
            list: [
                { icon: BookOpen, title: 'Brief da valutare', rows: todo.briefs.toEvaluate.map((b) => briefRow(b, 'nuova richiesta')) },
                { icon: CalendarCheck, title: 'Il cliente ha chiesto modifiche', rows: todo.ped.changesRequested.map((c) => pedRow(c, 'da correggere')) },
                { icon: BookOpen, title: 'Brief da portare a termine', rows: todo.briefs.inProgress.map((b) => briefRow(b, b.deadline ? `consegna ${new Date(b.deadline).toLocaleDateString('it-IT')}` : 'in corso')) },
                { icon: CalendarCheck, title: 'Approvazioni ferme da giorni', rows: todo.ped.waitingClient.map((c) => pedRow(c, 'nessuna risposta')) },
            ].filter((g) => g.rows.length > 0),
        };
    }, [briefs, contents, activeClients, clientsById]);

    if (!groups || groups.total === 0) return null;

    return (
        <section aria-labelledby="staff-todo-title" className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <h2 id="staff-todo-title" className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide text-foreground">
                Da chiudere
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">{groups.total}</span>
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
                {groups.list.map((g) => {
                    const Icon = g.icon;
                    return (
                        <div key={g.title}>
                            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                                <Icon className="h-3.5 w-3.5" aria-hidden="true" />{g.title} ({g.rows.length})
                            </h3>
                            <ul className="space-y-1">
                                {g.rows.slice(0, MAX_PER_GROUP).map((r) => (
                                    <li key={r.key}>
                                        <Link href={r.href} className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60">
                                            {r.urgent && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" aria-label="In ritardo" />}
                                            <span className="min-w-0"><b className="font-semibold">{r.client}</b> <span className="text-muted-foreground">· {r.text}</span></span>
                                        </Link>
                                    </li>
                                ))}
                                {g.rows.length > MAX_PER_GROUP && <li className="px-2 text-xs text-muted-foreground">e altri {g.rows.length - MAX_PER_GROUP}</li>}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
