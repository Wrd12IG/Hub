'use client';

import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { addTask, updateEditorialContent } from '@/lib/actions';
import { PRODUCTION_TYPES, linkedTaskIds, proposeProduction, suggestProductionTypes, type ProductionType } from '@/lib/content-production';
import type { Client, EditorialContent, User } from '@/lib/data';

interface Props {
    content: EditorialContent | null;
    client?: Client;
    users: User[];
    currentUserId?: string;
    onClose: () => void;
    onCreated: () => void;
}

const TYPES: ProductionType[] = ['graphic', 'video', 'photo'];

/**
 * Apre i task di produzione di un contenuto del PED (grafica, video, foto), con le scadenze calcolate all'indietro dalla
 * data di pubblicazione. L'assegnatario è solo un suggerimento (il primo responsabile del cliente): nulla viene creato
 * finché una persona non conferma.
 */
export function ProductionTasksDialog({ content, client, users, currentUserId, onClose, onCreated }: Props) {
    const today = new Date().toISOString().slice(0, 10);
    const suggested = client?.managedBy?.[0] || '';
    const [types, setTypes] = useState<ProductionType[]>([]);
    const [rows, setRows] = useState<Record<string, { title: string; dueDate: string; assignee: string }>>({});
    const [saving, setSaving] = useState(false);
    const [seenId, setSeenId] = useState<string | null>(null);

    // Si riparte dai tipi suggeriti ogni volta che si apre su un contenuto diverso
    if (content && seenId !== content.id) {
        setSeenId(content.id);
        setTypes(suggestProductionTypes(content));
        setRows({});
    }
    if (!content && seenId) setSeenId(null);

    const proposal = useMemo(() => (content ? proposeProduction(content, types, today) : null), [content, types, today]);
    const existing = content ? linkedTaskIds(content).length : 0;

    const view = (p: NonNullable<typeof proposal>[number]) => ({ ...p, ...rows[p.type], title: rows[p.type]?.title ?? p.title, dueDate: rows[p.type]?.dueDate ?? p.dueDate, assignee: rows[p.type]?.assignee ?? suggested });
    const edit = (type: ProductionType, patch: Partial<{ title: string; dueDate: string; assignee: string }>) =>
        setRows((r) => ({ ...r, [type]: { title: r[type]?.title ?? '', dueDate: r[type]?.dueDate ?? '', assignee: r[type]?.assignee ?? suggested, ...patch } }));

    const toggle = (t: ProductionType) => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

    const confirm = async () => {
        if (!content || !proposal) return;
        setSaving(true);
        try {
            const created: string[] = [];
            for (const p of proposal.map(view)) {
                const { taskId } = await addTask({
                    title: p.title,
                    description: `Task di produzione dal PED. Contenuto: ${content.topic}. Pubblicazione prevista: ${content.publicationDate?.slice(0, 10)}.\n\nCarica qui il file finito: poi si importa nel contenuto.`,
                    priority: p.late ? 'Alta' : 'Media',
                    status: 'Da Fare',
                    dueDate: new Date(`${p.dueDate}T17:00:00`).toISOString(),
                    clientId: content.clientId,
                    projectId: content.projectId || undefined,
                    estimatedDuration: p.minutes,
                    timeSpent: 0,
                    assignedUserId: p.assignee || undefined,
                    attachments: [],
                    comments: [],
                    dependencies: [],
                    editorialContentId: content.id,
                }, currentUserId || 'system_auto');
                created.push(taskId);
            }
            const all = [...linkedTaskIds(content), ...created];
            await updateEditorialContent(content.id, { taskIds: all, taskId: all[0] });
            toast.success(created.length === 1 ? 'Task di produzione creato.' : `${created.length} task di produzione creati.`);
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
                    <DialogTitle>Task di produzione</DialogTitle>
                    <DialogDescription>
                        {content?.topic} — pubblicazione {content?.publicationDate?.slice(0, 10) || 'senza data'}. Scegli cosa serve, controlla scadenze e assegnatari, poi conferma.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap gap-2">
                    {TYPES.map((t) => (
                        <label key={t} className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                            <input type="checkbox" checked={types.includes(t)} onChange={() => toggle(t)} />
                            {PRODUCTION_TYPES[t].label}
                        </label>
                    ))}
                </div>
                {existing > 0 && <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">Questo contenuto ha già {existing} task collegati: i nuovi si aggiungono.</p>}

                {!proposal ? (
                    <p className="text-sm text-muted-foreground">
                        {types.length === 0 ? 'Scegli almeno un tipo di lavorazione.' : 'Serve una data di pubblicazione futura per calcolare le scadenze all\'indietro.'}
                    </p>
                ) : (
                    <div className="space-y-2">
                        {proposal.map(view).map((p) => (
                            <div key={p.type} className="grid grid-cols-[1fr_9rem_10rem] items-center gap-2">
                                <input value={p.title} onChange={(e) => edit(p.type, { title: e.target.value })} className="rounded-md border bg-background p-1.5 text-sm" />
                                <input type="date" value={p.dueDate} onChange={(e) => edit(p.type, { dueDate: e.target.value })}
                                    className={`rounded-md border bg-background p-1.5 text-sm ${p.late ? 'border-red-400' : ''}`} title={p.late ? 'La scadenza ideale era già passata' : undefined} />
                                <select value={p.assignee} onChange={(e) => edit(p.type, { assignee: e.target.value })} className="rounded-md border bg-background p-1.5 text-sm">
                                    <option value="">Da assegnare</option>
                                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === suggested ? ' (proposto)' : ''}</option>)}
                                </select>
                            </div>
                        ))}
                        {proposal.some((p) => p.late) && <p className="text-xs text-red-600">Le righe in rosso partono già in ritardo: scadenza portata a oggi e priorità Alta.</p>}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Annulla</Button>
                    <Button disabled={!proposal || saving} onClick={confirm}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crea task
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
