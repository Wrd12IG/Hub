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
import { renderSlidesToJpeg } from './export';
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
            if (!file.type.startsWith('image/')) continue;
            const [size, [att]] = await Promise.all([imageSize(file), uploadFilesAndGetAttachments([file], 'editorial-plan/story-media', userId)]);
            out.push({ url: att.url, filename: file.name, width: size.width, height: size.height, kind: 'image' });
        }
        return out;
    }, [userId]);

    const onSave = async ({ design: d, title, igStories, fbStories, onProgress }: SavePayload) => {
        // Se il contenuto era già inviato o approvato, cambiarne la grafica lo riporta in bozza: va riapprovato
        const wasSent = !!content && contentId && ['Approvato', 'In Approvazione Cliente'].includes(content.status);
        if (wasSent && !window.confirm('Questo contenuto era già inviato o approvato. Salvando torna in bozza e il cliente dovrà approvarlo di nuovo. Continuare?')) return;

        onProgress('Preparo le immagini…');
        const blobs = await renderSlidesToJpeg(d.slides, (done, total) => onProgress(`Preparo le immagini ${done}/${total}…`));
        onProgress('Carico le immagini…');
        const stamp = Date.now();
        const files = blobs.map((b, i) => new File([b], `storia-${stamp}-${i + 1}.jpg`, { type: 'image/jpeg' }));
        const attachments = await uploadFilesAndGetAttachments(files, 'editorial-plan/stories', userId);
        const imageUrls = attachments.map((a) => a.url);
        const storyData = serializeDesign(d);

        onProgress('Salvo nel PED…');
        if (contentId) {
            await updateEditorialContent(contentId, {
                topic: title, igStories, fbStories, imageUrls, storyData,
                ...(wasSent ? { status: 'Bozza', approval: null as any } : {}),
            });
        } else {
            const id = await addEditorialContent({
                topic: title, clientId, format: 'Storia', status: 'Bozza',
                facebook: false, instagram: false, linkedin: false, tiktok: false, youtube: false, gbp: false,
                igStories, fbStories, imageUrls, storyData, copy: '',
            });
            setContentId(id);
            router.replace(`/clients/${clientId}/stories/new?draftId=${id}`);
        }
    };

    if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <StoryEditor
            clientName={clientName}
            backHref={`/clients/${clientId}/editorial-plan`}
            initialDesign={design}
            initialTitle={content?.topic || ''}
            initialChannels={{ igStories: content ? content.igStories !== false : true, fbStories: !!content?.fbStories }}
            palette={DEFAULT_PALETTE}
            onUploadFiles={onUploadFiles}
            onSave={onSave}
        />
    );
}
