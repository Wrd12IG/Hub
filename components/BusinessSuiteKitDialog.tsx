'use client';

import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { markStoryInBusinessSuite } from '@/lib/actions';
import { authFetch } from '@/lib/client-api-auth';
import { viaProxy } from '@/lib/story-editor/proxy';
import { AREA_LABEL, businessSuiteUrl, storyKit, type KitCard } from '@/lib/story-editor/business-suite';
import { scheduledInstant } from '@/lib/publisher';
import type { Client, EditorialContent } from '@/lib/data';

interface Props {
    content: EditorialContent | null;
    client?: Client;
    currentUserName?: string;
    onClose: () => void;
    onChanged: () => void;
}

const when = (publicationDate?: string) => {
    const at = scheduledInstant(publicationDate);
    return at ? new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(at) : null;
};

/** Scarica un file (passando dal proxy del Hub, che manda il token) con un nome leggibile. */
async function downloadCard(card: KitCard, topic: string): Promise<void> {
    const src = viaProxy(card.url);
    const res = src === card.url ? await fetch(card.url) : await authFetch(src);
    if (!res.ok) throw new Error(`download non riuscito (${res.status})`);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (topic || 'storia').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'storia';
    a.href = href;
    a.download = `${slug}-${card.index + 1}.${card.kind === 'video' ? 'mp4' : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

/**
 * Kit per programmare in Meta Business Suite una storia Instagram con il link sticker (l'API di Meta non lo pubblica):
 * le slide pronte nell'ordine giusto, il link di ogni slide da copiare e la zona dove mettere lo sticker, poi il segno
 * «programmata» che toglie la storia dalla pubblicazione automatica.
 */
export function BusinessSuiteKitDialog({ content, client, currentUserName, onClose, onChanged }: Props) {
    const cards = useMemo(() => (content ? storyKit(content) : []), [content]);
    const [busy, setBusy] = useState<string | null>(null);
    const [copied, setCopied] = useState<number | null>(null);
    const state = content?.publishResults?.igStories;
    const marked = state?.status === 'published' && state.via === 'business-suite';
    const published = state?.status === 'published' && state.via !== 'business-suite';
    const date = when(content?.publicationDate);
    const approved = content?.status === 'Approvato' && content.approval?.status === 'approved';

    const copy = async (card: KitCard) => {
        if (!card.link) return;
        try { await navigator.clipboard.writeText(card.link); setCopied(card.index); setTimeout(() => setCopied(null), 1500); }
        catch { toast.error('Copia non riuscita: seleziona il link e copialo a mano'); }
    };

    const downloadAll = async () => {
        if (!content) return;
        setBusy('download');
        try {
            for (const c of cards) await downloadCard(c, content.topic);
        } catch (e: any) {
            toast.error(`Download: ${e?.message || 'errore'}`);
        } finally { setBusy(null); }
    };

    const toggleMark = async () => {
        if (!content) return;
        setBusy('mark');
        try {
            await markStoryInBusinessSuite(content.id, !marked, currentUserName);
            toast.success(marked ? 'Segno tolto' : 'Segnata come programmata in Business Suite');
            onChanged();
            if (!marked) onClose();
        } catch (e: any) {
            toast.error(e?.message || 'Salvataggio non riuscito');
        } finally { setBusy(null); }
    };

    return (
        <Dialog open={!!content} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Kit Business Suite</DialogTitle>
                    <DialogDescription>
                        {content?.topic} · {client?.name || 'cliente'} · {date ? `da pubblicare ${date}` : 'senza data'}. L&apos;API di Meta non pubblica il link sticker: questa storia si programma da Meta Business Suite, dove lo sticker è cliccabile.
                    </DialogDescription>
                </DialogHeader>

                {!approved && !marked && (
                    <p className="rounded-md border border-amber-400/50 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                        Il contenuto non risulta ancora approvato: programmalo in Business Suite solo dopo l&apos;approvazione del cliente.
                    </p>
                )}
                {published && (
                    <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">Risulta già pubblicata dal Hub (senza link sticker).</p>
                )}

                <ol className="space-y-1 text-sm text-muted-foreground list-decimal pl-5">
                    <li>Scarica le slide (escono già nell&apos;ordine giusto).</li>
                    <li>Apri Business Suite sulla pagina del cliente → <b>Crea storia</b>, carica le slide in ordine.</li>
                    <li>Sulle slide con il link: <b>Modifica → Sticker → Link</b>, incolla il link e mettilo nella zona indicata.</li>
                    <li>Scegli <b>Programma</b> {date ? <>per <b>{date}</b></> : 'con la data voluta'}, poi torna qui e segna la storia come programmata.</li>
                </ol>

                {cards.length === 0 ? (
                    <p className="text-sm text-red-600">Nessuna slide salvata: apri la storia nell&apos;editor e salvala prima.</p>
                ) : (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {cards.map((c) => (
                            <div key={c.index} className="space-y-1.5 rounded-lg border p-2">
                                <div className="relative aspect-[9/16] overflow-hidden rounded-md bg-muted">
                                    {c.kind === 'video'
                                        ? <video src={c.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                                        // eslint-disable-next-line @next/next/no-img-element
                                        : <img src={c.url} alt={`Slide ${c.index + 1}`} className="h-full w-full object-cover" />}
                                    <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 text-xs font-semibold text-white">{c.index + 1}{c.kind === 'video' ? ' · video' : ''}</span>
                                    {c.link && c.area && (
                                        <span className={`absolute inset-x-1 rounded bg-sky-500/90 px-1 py-0.5 text-center text-[10px] font-semibold text-white ${c.area === 'alto' ? 'top-[20%]' : c.area === 'centro' ? 'top-1/2 -translate-y-1/2' : 'bottom-[18%]'}`}>🔗 link qui</span>
                                    )}
                                </div>
                                {c.link ? (
                                    <div className="space-y-1">
                                        <button type="button" onClick={() => copy(c)} className="flex w-full items-center gap-1 rounded border px-1.5 py-1 text-left text-[11px] hover:bg-muted" title={c.link}>
                                            {copied === c.index ? <Check className="h-3 w-3 shrink-0 text-green-600" /> : <Copy className="h-3 w-3 shrink-0" />}
                                            <span className="truncate">{c.link.replace(/^https?:\/\//, '')}</span>
                                        </button>
                                        <p className="text-[10px] text-muted-foreground">Sticker link {c.area ? AREA_LABEL[c.area] : 'dove preferisci'}</p>
                                    </div>
                                ) : <p className="text-[10px] text-muted-foreground">Nessun link</p>}
                            </div>
                        ))}
                    </div>
                )}

                <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" onClick={downloadAll} disabled={!!busy || cards.length === 0}>
                            {busy === 'download' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Scarica le slide
                        </Button>
                        <Button type="button" variant="outline" asChild>
                            <a href={businessSuiteUrl(client?.windsorAccounts?.facebook_page)} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Apri Business Suite</a>
                        </Button>
                    </div>
                    <Button type="button" onClick={toggleMark} disabled={!!busy || published || (!marked && cards.length === 0)} variant={marked ? 'outline' : 'default'}>
                        {busy === 'mark' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {marked ? `Togli «programmata»${state?.markedBy ? ` (${state.markedBy})` : ''}` : 'Segna come programmata'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
