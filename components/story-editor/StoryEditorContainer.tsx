'use client';

/**
 * components/story-editor/StoryEditorContainer.tsx
 *
 * Collega l'editor delle storie al Hub: carica la bozza dal PED, carica i file su Firebase Storage e salva il progetto
 * come contenuto «Storia» in bozza (una immagine JPEG per ogni slide). Da lì segue il giro normale: approvazione del
 * cliente → pubblicazione (un'azione di Instagram per ogni slide).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { addEditorialContent, getEditorialContent, updateEditorialContent, uploadFilesAndGetAttachments } from '@/lib/actions';
import { useLayoutData } from '@/app/(app)/layout-context';
import { parseStoryData, serializeDesign } from '@/lib/story-editor/serialize';
import type { StoryDesign } from '@/lib/story-editor/types';
import { DEFAULT_PALETTE } from '@/lib/story-editor/templates';
import type { EditorialContent } from '@/lib/data';
import { StoryEditor, type SavePayload } from './StoryEditor';
import { toast } from 'sonner';
import { buildStoryFiles } from './save-pipeline';
import { runAfterSave } from './after-save';
import { authFetch } from '@/lib/client-api-auth';
import { canBypassApproval } from '@/lib/content-approval';
import { rememberLocalFile } from './local-media';
import type { UploadedMedia } from './panels';

function imageSize(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
        img.onerror = () => { resolve({ width: 1080, height: 1080 }); URL.revokeObjectURL(url); };
        img.src = url;
    });
}

/** Misure e durata di un video appena scelto (null se il browser non sa leggerlo). */
function videoMeta(file: File): Promise<{ width: number; height: number; duration: number } | null> {
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const v = document.createElement('video');
        const done = (r: { width: number; height: number; duration: number } | null) => { URL.revokeObjectURL(url); resolve(r); };
        const timer = setTimeout(() => done(null), 15_000);
        v.preload = 'metadata'; v.muted = true;
        v.onloadedmetadata = () => { clearTimeout(timer); done(v.videoWidth ? { width: v.videoWidth, height: v.videoHeight, duration: v.duration } : null); };
        v.onerror = () => { clearTimeout(timer); done(null); };
        v.src = url;
    });
}

export default function StoryEditorContainer({ clientId }: { clientId: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { clientsById, currentUser } = useLayoutData();
    const draftId = searchParams.get('draftId');
    const [content, setContent] = useState<EditorialContent | null>(null);
    const [design, setDesign] = useState<StoryDesign | null>(null);
    const [loading, setLoading] = useState(!!draftId);
    const [contentId, setContentId] = useState<string | null>(draftId);

    useEffect(() => {
        if (!draftId) return;
        let alive = true;
        getEditorialContent(draftId)
            .then((c) => {
                if (!alive) return;
                // Un contenuto già pubblicato non si riscrive: si parte da una copia nuova
                if (c && c.status === 'Pubblicato') { setContentId(null); }
                if (c) { setContent(c); setDesign(parseStoryData((c as any).storyData)); }
            })
            .catch((e) => console.error('Errore caricamento bozza:', e))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [draftId]);

    const clientName = clientsById?.[clientId]?.name || 'Cliente';
    const userId = currentUser?.id || 'anonymous';

    const onUploadFiles = useMemo(() => async (files: File[]): Promise<UploadedMedia[]> => {
        const out: UploadedMedia[] = [];
        for (const file of files) {
            if (file.type.startsWith('video/')) {
                const meta = await videoMeta(file);
                if (!meta) throw new Error('Il browser non riesce a leggere questo video: prova un MP4 (H.264).');
                const [att] = await uploadFilesAndGetAttachments([file], 'editorial-plan/story-media', userId);
                rememberLocalFile(att.url, file); // l'esportazione lo rilegge da qui, senza riscaricarlo
                out.push({ url: att.url, filename: file.name, width: meta.width, height: meta.height, kind: 'video', duration: meta.duration });
                continue;
            }
            if (!file.type.startsWith('image/')) continue;
            const [size, [att]] = await Promise.all([imageSize(file), uploadFilesAndGetAttachments([file], 'editorial-plan/story-media', userId)]);
            if (file.type === 'image/gif') rememberLocalFile(att.url, file);
            out.push({ url: att.url, filename: file.name, width: size.width, height: size.height, kind: 'image' });
        }
        return out;
    }, [userId]);

    const onSave = async ({ design: d, title, igStories, fbStories, storyLink, publicationDate, afterSave, onProgress }: SavePayload) => {
        // Se il contenuto era già inviato o approvato, cambiarne la grafica lo riporta in bozza: va riapprovato
        const wasSent = !!content && contentId && ['Approvato', 'In Approvazione Cliente'].includes(content.status);
        if (wasSent && !window.confirm('Questo contenuto era già inviato o approvato. Salvando torna in bozza e il cliente dovrà approvarlo di nuovo. Continuare?')) return;

        const { imageUrls, storyMedia, videoBySlide, warnings } = await buildStoryFiles({
            design: d,
            onProgress,
            upload: async (files, folder) => (await uploadFilesAndGetAttachments(files, folder, userId)).map((a) => a.url),
        });
        const storyData = serializeDesign(d);

        onProgress('Salvo nel PED…');
        let savedId = contentId;
        if (contentId) {
            await updateEditorialContent(contentId, {
                topic: title, igStories, fbStories, imageUrls, storyMedia, storyData, storyLink, publicationDate,
                ...(wasSent ? { status: 'Bozza', approval: null as any } : {}),
            });
        } else {
            const id = await addEditorialContent({
                topic: title, clientId, format: 'Storia', status: 'Bozza',
                facebook: false, instagram: false, linkedin: false, tiktok: false, youtube: false, gbp: false,
                igStories, fbStories, imageUrls, storyMedia, storyData, storyLink, publicationDate, copy: '',
            });
            savedId = id;
            setContentId(id);
            router.replace(`/clients/${clientId}/stories/new?draftId=${id}`);
        }
        warnings.forEach((w) => toast.warning(w, { duration: 12000 }));
        if (savedId && afterSave !== 'draft') {
            onProgress(afterSave === 'approve' ? 'Approvo…' : 'Mando al cliente…');
            const r = await runAfterSave({ clientId, contentId: savedId, mode: afterSave, post: (url, init) => authFetch(url, init) });
            if (r) {
                if (r.shareUrl) { try { await navigator.clipboard.writeText(r.shareUrl); } catch { /* appunti non disponibili */ } }
                (r.level === 'success' ? toast.success : r.level === 'warning' ? toast.warning : toast.error)(r.message, { duration: 12000 });
            }
        }
        const nVideo = Object.keys(videoBySlide).length;
        // Dopo il salvataggio l'editor resta aperto: l'avviso dice dove è finita la storia e porta al PED con un clic
        toast.success(nVideo > 0 ? `Salvato nel PED: ${nVideo} ${nVideo === 1 ? 'slide esce' : 'slide escono'} come video MP4.` : 'Salvato nel PED.', {
            duration: 15000,
            action: { label: 'Apri il PED', onClick: () => router.push(`/clients/${clientId}/editorial-plan`) },
        });
    };

    if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <StoryEditor
            clientId={clientId}
            clientName={clientName}
            backHref={`/clients/${clientId}/editorial-plan`}
            initialDesign={design}
            initialTitle={content?.topic || ''}
            initialChannels={{ igStories: content ? content.igStories !== false : true, fbStories: !!content?.fbStories }}
            initialStoryLink={content?.storyLink || ''}
            initialPublicationDate={content?.publicationDate || ''}
            canApprove={canBypassApproval(currentUser as any)}
            palette={DEFAULT_PALETTE}
            onUploadFiles={onUploadFiles}
            onSave={onSave}
        />
    );
}
