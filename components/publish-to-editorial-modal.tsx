'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Project, Task } from '@/lib/data';
import { addEditorialContent, updateTask } from '@/lib/actions';
import { canInsertInPed, splitTaskMedia, suggestFormat } from '@/lib/task-to-content';
import { useLayoutData } from '@/app/(app)/layout-context';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Calendar as CalendarIcon, Loader2, Sparkles, Share2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

interface PublishToEditorialModalProps {
    isOpen: boolean;
    onClose: () => void;
    project?: Project | null;
    task?: Task | null;
}

export function PublishToEditorialModal({
    isOpen,
    onClose,
    project,
    task,
}: PublishToEditorialModalProps) {
    const { clients, refetchData, currentUser } = useLayoutData();
    const router = useRouter();

    const clientId = project?.clientId || task?.clientId || '';
    const client = clients.find(c => c.id === clientId);

    const [topic, setTopic] = useState(project?.name || task?.title || '');
    const [copy, setCopy] = useState(project?.description || task?.description || '');
    const [publicationDate, setPublicationDate] = useState(
        format(new Date(Date.now() + 86400000 * 2), 'yyyy-MM-dd')
    );
    const [selectedFormat, setSelectedFormat] = useState('Reel');
    // Dal task il contenuto entra nel PED come BOZZA: l'approvazione la dà il cliente (o un amministratore) sul contenuto.
    const status = task ? 'Bozza' : 'Programmato';

    const media = useMemo(() => splitTaskMedia(task?.attachments), [task]);
    const [pickedImages, setPickedImages] = useState<string[]>([]);
    const [pickedVideo, setPickedVideo] = useState<string>('');
    const eligibility = task ? canInsertInPed(task) : ({ ok: true } as const);

    // Il componente resta montato mentre cambia il task scelto: i campi si riallineano ogni volta.
    useEffect(() => {
        setTopic(project?.name || task?.title || '');
        setCopy(project?.description || task?.description || '');
        const imgs = splitTaskMedia(task?.attachments).images.map(a => a.url);
        setPickedImages(imgs);
        setPickedVideo('');
        setSelectedFormat(suggestFormat(imgs.length, false));
    }, [task?.id, project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Social Channels
    const [channels, setChannels] = useState({
        instagram: true,
        facebook: true,
        igStories: false,
        linkedin: false,
        tiktok: false,
        youtube: false,
        gbp: false,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChannelToggle = (key: keyof typeof channels) => {
        setChannels(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!topic || !clientId) {
            toast.error("Titolo e Cliente sono obbligatori per il PED.");
            return;
        }
        if (task && !eligibility.ok) {
            toast.error(eligibility.reason);
            return;
        }

        setIsSubmitting(true);
        try {
            const contentId = await addEditorialContent({
                topic,
                clientId,
                copy,
                format: selectedFormat,
                status,
                publicationDate,
                facebook: channels.facebook,
                instagram: channels.instagram,
                igStories: channels.igStories,
                linkedin: channels.linkedin,
                tiktok: channels.tiktok,
                youtube: channels.youtube,
                gbp: channels.gbp,
                projectId: project?.id,
                taskId: task?.id,
                ...(task ? { taskIds: [task.id] } : {}),
                ...(pickedImages.length > 0 ? { imageUrls: pickedImages } : {}),
                ...(pickedVideo ? { videoUrl: pickedVideo } : {}),
            });
            // Il collegamento va scritto anche sul task: la scheda del task mostra il contenuto e non lo si programma due volte.
            if (task) await updateTask(task.id, { editorialContentId: contentId }, currentUser?.id || 'system_auto');

            toast.success(task ? "Inserito nel PED come bozza." : "Post aggiunto al Piano Editoriale con successo!");
            if (refetchData) await refetchData('all');
            onClose();

            // Direct link toast option to navigate to client's editorial plan
            toast.info("Vai al Piano Editoriale del Cliente", {
                action: {
                    label: "Apri Piano",
                    onClick: () => router.push(`/clients/${clientId}/editorial-plan`),
                },
            });
        } catch (error) {
            console.error("Failed to publish to editorial plan", error);
            toast.error("Errore durante la creazione del post nel Piano Editoriale.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl bg-background border-border shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-primary">
                        <Share2 className="h-5 w-5 text-amber-500" />
                        Inserisci nel PED
                    </DialogTitle>
                    <DialogDescription>
                        Inserisci il lavoro nel PED del cliente come bozza. Potrà essere pubblicato solo dopo l'approvazione del cliente (o di un amministratore).
                    </DialogDescription>
                </DialogHeader>

                {task && !eligibility.ok && (
                    <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">{eligibility.reason}.</p>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 py-2">
                    {/* Cliente Info */}
                    <div className="p-3 rounded-lg bg-muted/40 border border-border flex items-center justify-between text-xs">
                        <span className="text-muted-foreground font-medium">Cliente Destinatario:</span>
                        <span className="font-bold text-foreground">{client?.name || 'Cliente Selezionato'}</span>
                    </div>

                    {/* Titolo Post / Argomento */}
                    <div className="space-y-1.5">
                        <Label htmlFor="topic" className="text-xs font-semibold">Titolo Post / Argomento</Label>
                        <Input
                            id="topic"
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                            placeholder="Titolo del post..."
                            required
                        />
                    </div>

                    {/* Copywriting / Testo */}
                    <div className="space-y-1.5">
                        <Label htmlFor="copy" className="text-xs font-semibold">Testo / Copywriting</Label>
                        <Textarea
                            id="copy"
                            value={copy}
                            onChange={e => setCopy(e.target.value)}
                            placeholder="Inserisci il testo approvato per i social..."
                            rows={4}
                        />
                    </div>

                    {/* Formato & Data Pubblicazione */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Formato</Label>
                            <Select value={selectedFormat} onValueChange={setSelectedFormat}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Seleziona formato" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Reel"> Reel / Video</SelectItem>
                                    <SelectItem value="Carosello"> Carosello Grafico</SelectItem>
                                    <SelectItem value="Post Singolo"> Post Singolo</SelectItem>
                                    <SelectItem value="Story"> Story Instagram/FB</SelectItem>
                                    <SelectItem value="Articolo"> Articolo / Blog</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="publicationDate" className="text-xs font-semibold">Data Pubblicazione</Label>
                            <Input
                                id="publicationDate"
                                type="date"
                                value={publicationDate}
                                onChange={e => setPublicationDate(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Media dal task */}
                    {task && (media.images.length > 0 || media.videos.length > 0) && (
                        <div className="space-y-2 pt-2 border-t border-border/40">
                            <Label className="text-xs font-semibold block">Media del task</Label>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                {media.images.map(a => (
                                    <label key={a.url} className="flex items-center gap-2 p-2 rounded border bg-card cursor-pointer">
                                        <Checkbox
                                            checked={pickedImages.includes(a.url)}
                                            onCheckedChange={(c) => {
                                                const next = c ? [...pickedImages, a.url] : pickedImages.filter(u => u !== a.url);
                                                setPickedImages(next);
                                                setSelectedFormat(suggestFormat(next.length, !!pickedVideo));
                                            }}
                                        />
                                        <span className="truncate">{a.filename}</span>
                                    </label>
                                ))}
                                {media.videos.map(a => (
                                    <label key={a.url} className="flex items-center gap-2 p-2 rounded border bg-card cursor-pointer">
                                        <Checkbox
                                            checked={pickedVideo === a.url}
                                            onCheckedChange={(c) => {
                                                const v = c ? a.url : '';
                                                setPickedVideo(v);
                                                setSelectedFormat(suggestFormat(pickedImages.length, !!v));
                                            }}
                                        />
                                        <span className="truncate">Video: {a.filename}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-[11px] text-muted-foreground">Instagram e Facebook pubblicano solo media con indirizzo pubblico (https): sono quelli elencati qui.</p>
                        </div>
                    )}

                    {/* Canali Social Checkbox Selection */}
                    <div className="space-y-2 pt-2 border-t border-border/40">
                        <Label className="text-xs font-semibold block">Canali di Destinazione</Label>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                            <label className="flex items-center gap-2 p-2 rounded border bg-card hover:bg-muted/40 cursor-pointer">
                                <Checkbox checked={channels.instagram} onCheckedChange={() => handleChannelToggle('instagram')} />
                                <span> Instagram</span>
                            </label>
                            <label className="flex items-center gap-2 p-2 rounded border bg-card hover:bg-muted/40 cursor-pointer">
                                <Checkbox checked={channels.facebook} onCheckedChange={() => handleChannelToggle('facebook')} />
                                <span> Facebook</span>
                            </label>
                            <label className="flex items-center gap-2 p-2 rounded border bg-card hover:bg-muted/40 cursor-pointer">
                                <Checkbox checked={channels.igStories} onCheckedChange={() => handleChannelToggle('igStories')} />
                                <span> IG Stories</span>
                            </label>
                            <label className="flex items-center gap-2 p-2 rounded border bg-card hover:bg-muted/40 cursor-pointer">
                                <Checkbox checked={channels.linkedin} onCheckedChange={() => handleChannelToggle('linkedin')} />
                                <span> LinkedIn</span>
                            </label>
                            <label className="flex items-center gap-2 p-2 rounded border bg-card hover:bg-muted/40 cursor-pointer">
                                <Checkbox checked={channels.tiktok} onCheckedChange={() => handleChannelToggle('tiktok')} />
                                <span> TikTok</span>
                            </label>
                            <label className="flex items-center gap-2 p-2 rounded border bg-card hover:bg-muted/40 cursor-pointer">
                                <Checkbox checked={channels.youtube} onCheckedChange={() => handleChannelToggle('youtube')} />
                                <span> YouTube</span>
                            </label>
                        </div>
                    </div>

                    <DialogFooter className="pt-4 border-t border-border">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Annulla
                        </Button>
                        <Button type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold gap-1.5" disabled={isSubmitting || (!!task && !eligibility.ok)}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Inserimento in corso...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4 fill-slate-950" />
                                    Inserisci nel PED
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default PublishToEditorialModal;
