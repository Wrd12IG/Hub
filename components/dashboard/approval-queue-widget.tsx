'use client';

// Coda approvazioni per la dashboard: i task che aspettano da più tempo,
// con chi deve muoversi. Risponde a «cosa sta bloccando il lavoro?».

import Link from 'next/link';
import { Timer } from 'lucide-react';
import type { Task, Client } from '@/lib/data';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { approvalWaitTone, approvalWaitLabel, approverName } from '@/lib/approval-wait';
import { cn } from '@/lib/utils';

function toDate(v: unknown): Date | null {
    if (!v) return null;
    if (typeof v === 'string') return new Date(v);
    if (typeof (v as any).toDate === 'function') return (v as any).toDate();
    return v instanceof Date ? v : null;
}

interface Props {
    tasks: Task[];
    clientsById: Record<string, Client>;
    usersById: Record<string, { name?: string } | undefined>;
    max?: number;
}

export function ApprovalQueueWidget({ tasks, clientsById, usersById, max = 5 }: Props) {
    const now = Date.now();
    const waiting = tasks
        .filter(t => t.status === 'In Approvazione' || t.status === 'In Approvazione Cliente')
        .map(t => {
            const since = toDate(t.statusChangedAt || t.updatedAt);
            const days = since ? Math.floor((now - since.getTime()) / 86_400_000) : 0;
            return { task: t, days };
        })
        .sort((a, b) => b.days - a.days);

    if (waiting.length === 0) return null;

    const late = waiting.filter(w => approvalWaitTone(w.days) === 'late').length;

    return (
        <Card className="glass-card h-full">
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                    <Timer className="h-4 w-4" /> Approvazioni in attesa
                </CardTitle>
                <CardDescription>
                    {waiting.length} in attesa{late > 0 ? ` · ${late} da 3 giorni o più` : ''}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5">
                {waiting.slice(0, max).map(({ task, days }) => {
                    const tone = approvalWaitTone(days);
                    const client = task.clientId ? clientsById[task.clientId] : undefined;
                    const who = approverName(task.status, client, usersById);
                    return (
                        <Link
                            key={task.id}
                            href={`/tasks?taskId=${task.id}`}
                            className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-secondary/60 transition-colors"
                        >
                            <span className={cn(
                                'shrink-0 w-14 text-right text-sm font-bold tabular-nums',
                                tone === 'late' && 'text-red-600',
                                tone === 'warning' && 'text-amber-600',
                                tone === 'fresh' && 'text-muted-foreground'
                            )}>
                                {approvalWaitLabel(days)}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium truncate">{task.title}</span>
                                <span className="block text-xs text-muted-foreground truncate">
                                    {client?.name ?? 'Senza cliente'}{who ? ` · tocca a ${who}` : ''}
                                </span>
                            </span>
                        </Link>
                    );
                })}
                {waiting.length > max && (
                    <Link href="/tasks" className="block text-xs text-muted-foreground hover:text-foreground px-2 pt-1">
                        Vedi tutti i {waiting.length} task in approvazione →
                    </Link>
                )}
            </CardContent>
        </Card>
    );
}
