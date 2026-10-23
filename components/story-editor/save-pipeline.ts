/**
 * components/story-editor/save-pipeline.ts
 *
 * Dal progetto ai file da salvare: un JPEG per ogni slide (anteprima e riserva) e un MP4 per ogni slide con GIF o video di
 * sfondo, poi l'elenco finale nell'ordine delle slide. Il caricamento dei file è passato da fuori (`upload`), così qui non
 * c'è Firebase e si può collaudare. Un video che non riesce non blocca il salvataggio: quella slide esce come immagine
 * ferma e lo si dice.
 */
import type { StoryDesign } from '@/lib/story-editor/types';
import { buildStoryMedia, isVideoSlide, type StoryMediaItem } from '@/lib/story-editor/animation';
import { renderSlideToJpeg } from './export';
import { renderSlideToMp4, videoExportSupported } from './export-video';

export interface StoryFiles {
    imageUrls: string[];
    storyMedia: StoryMediaItem[];
    videoBySlide: Record<string, string>;
    warnings: string[];
}

export async function buildStoryFiles(args: {
    design: StoryDesign;
    /** Carica file e restituisce gli indirizzi, nello stesso ordine. */
    upload: (files: File[], folder: string) => Promise<string[]>;
    onProgress: (message: string) => void;
}): Promise<StoryFiles> {
    const { design, upload, onProgress } = args;
    const slides = design.slides;
    const total = slides.length;
    const stamp = Date.now();

    // 1. JPEG di ogni slide
    const blobs: Blob[] = [];
    for (let i = 0; i < total; i++) {
        onProgress(`Preparo le immagini ${i + 1}/${total}…`);
        blobs.push(await renderSlideToJpeg(slides[i]));
    }
    onProgress('Carico le immagini…');
    const imageUrls = await upload(blobs.map((b, i) => new File([b], `storia-${stamp}-${i + 1}.jpg`, { type: 'image/jpeg' })), 'editorial-plan/stories');

    // 2. MP4 delle slide animate
    const videoBySlide: Record<string, string> = {};
    const warnings: string[] = [];
    const animated = slides.filter(isVideoSlide);
    if (animated.length > 0) {
        if (!videoExportSupported()) {
            warnings.push('Questo browser non sa esportare video (serve Chrome, Edge o Safari aggiornati): le slide con GIF o video escono come immagini ferme.');
        } else {
            let n = 0;
            for (const slide of animated) {
                n++;
                const label = `Video ${n}/${animated.length}`;
                const position = slides.indexOf(slide) + 1;
                try {
                    const r = await renderSlideToMp4(slide, { onProgress: (done, tot, phase) => onProgress(tot > 1 ? `${label}: ${phase} ${Math.round((done / tot) * 100)}%` : `${label}: ${phase}…`) });
                    onProgress(`${label}: carico il video…`);
                    const [url] = await upload([new File([r.blob], `storia-${stamp}-${position}.mp4`, { type: 'video/mp4' })], 'editorial-plan/stories');
                    if (!url) throw new Error('caricamento non riuscito');
                    videoBySlide[slide.id] = url;
                    warnings.push(...r.notes.map((x) => `Slide ${position}: ${x}`));
                } catch (e: any) {
                    console.error('[story video]', e);
                    warnings.push(`Slide ${position}: ${e?.message || 'video non riuscito'}. Esce come immagine ferma.`);
                }
            }
        }
    }
    return { imageUrls, storyMedia: buildStoryMedia(slides, imageUrls, videoBySlide), videoBySlide, warnings };
}
