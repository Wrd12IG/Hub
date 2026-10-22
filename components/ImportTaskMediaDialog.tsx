'use client';

import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updateEditorialContent } from '@/lib/actions';
import { collectTaskMedia, mergeMedia } from '@/lib/content-production';
import type { EditorialContent, Task } from '@/lib/data';

interface Props {
    content: EditorialContent | null;
    /** I task collegati al contenuto, con i loro allegati. */
    tasks: Task[];
    onClose: () => void;
    onImported: () => void;
}

/** Porta nel contenuto le immagini e il video caricati nei task di produzione: il cliente approverà il materiale finito. */
export function ImportTaskMediaDialog({ content, tasks, onClose, onImported }: Props) {
    const items = useMemo(() => collectTaskMedia(tasks), [tasks]);
    const already = useMemo(() => new Set([...(content?.imageUrls || []), content?.videoUrl || '']), [content]);
    const [picked, setPicked] = useState<string[]>([]);
    const [seenId, setSeenId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    if (content && seenId !== content.id) {
        setSeenId(content.id);
        setPicked(items.filter((i) => !already.has(i.url)).map((i) => i.url));
    }
    if (!content && seenId) setSeenId(null);

    const confirm = async () => {
        if (!content) return;
        setSaving(true);
        try {
            const chosen = items.filter((i) => picked.includes(i.url));
            const videos = chosen.filter((i) => i.kind === 'video');
            const merged = mergeMedia(content, { images: chosen.filter((i) => i.kind === 'image').map((i) => i.url), video: videos[videos.length - 1]?.url });
            await updateEditorialContent(content.id, merged);
            toast.success('Media importati nel contenuto.');
            onImported();
            onClose();
        } catch (e: any) {
            toast.error(e?.message || 'Impossibile importare i media.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={!!content} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Importa media dai task</DialogTitle>
                    <DialogDescription>{content?.topic}: scegli le immagini e il video da usare nel contenuto.</DialogDescription>
                </DialogHeader>

                {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Questo contenuto non ha task collegati: apri prima i task di produzione.</p>
                ) : items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">I task collegati non hanno ancora immagini o video allegati (solo file con indirizzo pubblico https).</p>
                ) : (
                    <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                        {items.map((i) => {
                            const isIn = already.has(i.url);
                            return (
                                <label key={i.url} className={`relative flex cursor-pointer flex-col gap-1 rounded-md border p-2 text-xs ${isIn ? 'opacity-60' : ''}`}>
                                    {i.kind === 'image'
                                        // eslint-disable-next-line @next/next/no-img-element
                                        ? <img src={i.url} alt="" className="h-24 w-full rounded object-cover" />
                                        : <video src={`${i.url}#t=0.1`} preload="metadata" muted className="h-24 w-full rounded object-cover" />}
                                    <span className="flex items-center gap-2">
                                        <input type="checkbox" disabled={isIn} checked={isIn || picked.includes(i.url)}
                                            onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, i.url] : cur.filter((u) => u !== i.url)))} />
                                        <span className="truncate">{i.kind === 'video' ? 'Video: ' : ''}{i.filename}</span>
                                    </span>
                                    <span className="truncate text-muted-foreground">{isIn ? 'Già nel contenuto' : i.taskTitle}</span>
                                </label>
                            );
                        })}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Annulla</Button>
                    <Button disabled={saving || picked.length === 0} onClick={confirm}>
                        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importa
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
