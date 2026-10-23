'use client';

/**
 * components/story-editor/export.tsx
 *
 * Trasforma le slide in file JPEG 1080×1920 (il formato che Instagram accetta per le storie, fino a 8 MB). Ogni slide si
 * disegna su una tela fuori schermo, non interattiva, così nell'immagine non finiscono maniglie, guide o interfaccia.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type Konva from 'konva';
import type { Slide } from '@/lib/story-editor/types';
import { SlideStage } from './SlideStage';
import { preloadImages } from './image-cache';
import { loadPoster } from './video-poster';

/** Aspetta che la tela si sia disegnata. In una scheda in secondo piano requestAnimationFrame non scatta mai: per questo c'è un limite di tempo. */
export function nextPaint(): Promise<void> {
    const raf = new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const timeout = new Promise<void>((r) => setTimeout(r, 150));
    return Promise.race([raf, timeout]);
}

export function slideImageUrls(slide: Slide): string[] {
    return [
        ...(slide.background.type === 'image' ? [slide.background.url] : []),
        ...slide.layers.flatMap((l) => (l.type === 'image' ? [l.url] : [])),
    ];
}

export function slideFonts(slide: Slide): string[] {
    return Array.from(new Set(slide.layers.flatMap((l) => (l.type === 'text' ? [l.fontFamily] : []))));
}

async function ensureFonts(families: string[]): Promise<void> {
    if (typeof document === 'undefined' || !document.fonts) return;
    await Promise.all(families.flatMap((f) => [document.fonts.load(`700 48px "${f}"`), document.fonts.load(`400 48px "${f}"`)]));
    await document.fonts.ready;
}

const dataUrlToBlob = (dataUrl: string): Blob => {
    const [head, body] = dataUrl.split(',');
    const mime = /data:(.*?);base64/.exec(head)?.[1] || 'image/jpeg';
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
};

export async function renderSlideToJpeg(slide: Slide, quality = 0.92): Promise<Blob> {
    await preloadImages(slideImageUrls(slide));
    if (slide.background.type === 'video') await loadPoster(slide.background.url, slide.background.trimStart);
    await ensureFonts(slideFonts(slide));

    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-99999px;top:0;width:1080px;height:1920px;pointer-events:none;';
    document.body.appendChild(host);
    const root = createRoot(host);
    const ref = { current: null as Konva.Stage | null };
    try {
        flushSync(() => root.render(<SlideStage slide={slide} scale={1} stageRef={ref} />));
        // Due giri di disegno: le immagini sono già in cache, ma il testo si misura al primo disegno
        await nextPaint();
        if (!ref.current) throw new Error('La tela non è pronta');
        return dataUrlToBlob(ref.current.toDataURL({ mimeType: 'image/jpeg', quality, pixelRatio: 1 }));
    } finally {
        root.unmount();
        host.remove();
    }
}

export async function renderSlidesToJpeg(slides: Slide[], onProgress?: (done: number, total: number) => void): Promise<Blob[]> {
    const out: Blob[] = [];
    for (let i = 0; i < slides.length; i++) {
        out.push(await renderSlideToJpeg(slides[i]));
        onProgress?.(i + 1, slides.length);
    }
    return out;
}
