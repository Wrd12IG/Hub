'use client';

import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { addTask, updateEditorialContent } from '@/lib/actions';
import { proposeWorkplan } from '@/lib/content-workplan';
import type { Client, EditorialContent, User } from '@/lib/data';

interface Props {
    content: EditorialContent | null;
    client?: Client;
    users: User[];
    currentUserId?: string;
    onClose: () => void;
    onCreated: () => void;
}

/**
 * Propone i task di lavorazione di un contenuto, calcolati all'indietro dalla data di pubblicazione.
 * L'assegnatario è solo un suggerimento (il primo responsabile del cliente): si può cambiare riga per riga e nulla
 * viene creato finché una persona non conferma.
 */
export function ContentWorkplanDialog({ content, client, users, currentUserId, onClose, onCreated }: Props) {
    const today = new Date().toISOString().slice(0, 10);
    const proposal = useMemo(() => (content ? proposeWorkplan(content.publicationDate, today) : null), [content, today]);
    const suggested = client?.managedBy?.[0] || '';
    const [rows, setRows] = useState<{ key: string; title: string; dueDate: string; minutes: number; late: boolean; assignee: string; on: boolean }[]>([]);
    const [saving, setSaving] = useState(false);
    const [seenId, setSeenId] = useState<string | null>(null);

    // Si riparte dalla proposta ogni volta che si apre su un contenuto diverso.
    if (content && proposal && seenId !== content.id) {
        setSeenId(content.id);
        setRows(proposal.map((p) => ({ ...p, assignee: suggested, on: true })));
    }
    if (!content && seenId) setSeenId(null);

    const update = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

    const confirm = async () => {
        if (!content) return;
        setSaving(true);
        try {
            let firstId: string | undefined;
            for (const r of rows.filter((x) => x.on)) {
                const { taskId } = await addTask({
                    title: `${r.title} — ${content.topic}`,
                    description: `Task generato dal Piano Editoriale. Pubblicazione prevista: ${content.publicationDate?.slice(0, 10)}.`,
                    priority: r.late ? 'Alta' : 'Media',
                    status: 'Da Fare',
                    dueDate: new Date(`${r.dueDate}T17:00:00`).toISOString(),
                    clientId: content.clientId,
                    projectId: content.projectId || undefined,
                    estimatedDuration: r.minutes,
                    timeSpent: 0,
                    assignedUserId: r.assignee || undefined,
                    attachments: [],
                    comments: [],
                    dependencies: [],
                    editorialContentId: content.id,
                }, currentUserId || 'system_auto');
                firstId = firstId || taskId;
            }
            if (firstId && !content.taskId) await updateEditorialContent(content.id, { taskId: firstId });
            toast.success('Task di lavorazione creati.');
            onCreated();
            onClose();
        } catch (e: any) {
            toast.error(e?.message || 'Impossibile creare i task.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={!!content} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Task di lavorazione</DialogTitle>
                    <DialogDescription>
                        {content?.topic} — pubblicazione {content?.publicationDate?.slice(0, 10) || 'senza data'}. Controlla scadenze e assegnatari prima di creare.
                    </DialogDescription>
                </DialogHeader>

                {!proposal ? (
                    <p className="text-sm text-muted-foreground">Serve una data di pubblicazione futura per calcolare le scadenze all&apos;indietro.</p>
                ) : (
                    <div className="space-y-2">
                        {content?.taskId && <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">Questo contenuto ha già un task collegato: i nuovi si aggiungono, non lo sostituiscono.</p>}
                        {rows.map((r, i) => (
                            <div key={r.key} className="grid grid-cols-[auto_1fr_9rem_10rem] items-center gap-2">
                                <input type="checkbox" checked={r.on} onChange={(e) => update(i, { on: e.target.checked })} aria-label={`Includi ${r.title}`} />
                                <input value={r.title} onChange={(e) => update(i, { title: e.target.value })} className="rounded-md border bg-background p-1.5 text-sm" />
                                <input type="date" value={r.dueDate} onChange={(e) => update(i, { dueDate: e.target.value })}
                                    className={`rounded-md border bg-background p-1.5 text-sm ${r.late ? 'border-red-400' : ''}`} title={r.late ? 'La scadenza ideale era già passata' : undefined} />
                                <select value={r.assignee} onChange={(e) => update(i, { assignee: e.target.value })} className="rounded-md border bg-background p-1.5 text-sm">
                                    <option value="">Da assegnare</option>
                                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === suggested ? ' (proposto)' : ''}</option>)}
                                </select>
                            </div>
                        ))}
                        {rows.some((r) => r.late) && <p className="text-xs text-red-600">Le righe in rosso partivano già in ritardo: scadenza portata a oggi e priorità Alta.</p>}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Annulla</Button>
                    <Button disabled={!proposal || saving || !rows.some((r) => r.on)} onClick={confirm}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crea task
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
