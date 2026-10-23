'use client';

/**
 * components/story-editor/export-video.tsx
 *
 * Esporta una slide con GIF animate e/o un video di sfondo come MP4 1080×1920 (H.264, il formato che Instagram accetta per
 * le storie, da 3 a 60 secondi). Tutto nel browser, senza ffmpeg: ogni fotogramma si compone su una tela 2D (sfondo,
 * livelli fermi disegnati da Konva, GIF al fotogramma giusto), poi lo codifica il VideoEncoder del browser (WebCodecs) e
 * mp4-muxer scrive il file. L'audio del video di sfondo si tiene se il browser sa codificare AAC; altrimenti il video
 * esce muto e lo si dice.
 */
import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type Konva from 'konva';
import { STORY_H, STORY_W, type ImageLayer, type Layer, type Slide } from '@/lib/story-editor/types';
import {
    VIDEO_FPS, cycleSeconds, frameCount, gifFrameIndexAt, isAnimatedLayer, normalizeDelays, slideDurationSeconds, trimRange,
} from '@/lib/story-editor/animation';
import { SlideStage } from './SlideStage';
import { preloadImages } from './image-cache';
import { nextPaint } from './export';
import { fetchMediaBuffer, getLocalFile } from './local-media';

export interface VideoExportResult { blob: Blob; durationSeconds: number; hasAudio: boolean; notes: string[] }
export interface VideoExportOptions { onProgress?: (done: number, total: number, phase: string) => void; signal?: AbortSignal }

export function videoExportSupported(): boolean {
    return typeof window !== 'undefined' && typeof (window as any).VideoEncoder !== 'undefined' && typeof (window as any).VideoFrame !== 'undefined';
}

/** Come isAnimatedLayer ma senza restringere il tipo (serve per escludere le GIF da un elenco di immagini). */
const animated = (l: Layer): boolean => isAnimatedLayer(l);
const tick = () => new Promise<void>((r) => setTimeout(r, 0));
function checkAbort(signal?: AbortSignal) { if (signal?.aborted) throw new DOMException('Esportazione annullata', 'AbortError'); }

// ─── GIF ──────────────────────────────────────────────────────────────────────

export interface GifAnimation { frames: HTMLCanvasElement[]; delays: number[]; width: number; height: number }

const MAX_GIF_SIDE = 720;
const MAX_GIF_FRAMES = 300;

/** Decodifica una GIF in fotogrammi già «composti» (con la sovrapposizione e la pulizia fra un fotogramma e l'altro). */
export async function decodeGif(buffer: ArrayBuffer): Promise<GifAnimation> {
    const { parseGIF, decompressFrames } = await import('gifuct-js');
    const gif = parseGIF(buffer);
    const patches = decompressFrames(gif, true).slice(0, MAX_GIF_FRAMES);
    if (patches.length === 0) throw new Error('GIF vuota');
    const gw = gif.lsd.width, gh = gif.lsd.height;
    const k = Math.min(1, MAX_GIF_SIDE / Math.max(gw, gh));
    const w = Math.max(1, Math.round(gw * k)), h = Math.max(1, Math.round(gh * k));

    const full = document.createElement('canvas'); full.width = gw; full.height = gh;
    const fctx = full.getContext('2d')!;
    const patch = document.createElement('canvas');
    const pctx = patch.getContext('2d')!;
    const frames: HTMLCanvasElement[] = [];
    const delays: number[] = [];
    let restore: ImageData | null = null;

    for (let i = 0; i < patches.length; i++) {
        const f = patches[i];
        // Cosa fare del fotogramma PRECEDENTE prima di disegnare questo (2 = svuota la sua area, 3 = ripristina)
        if (i > 0) {
            const prev = patches[i - 1];
            if (prev.disposalType === 2) fctx.clearRect(prev.dims.left, prev.dims.top, prev.dims.width, prev.dims.height);
            else if (prev.disposalType === 3 && restore) fctx.putImageData(restore, 0, 0);
        }
        if (f.disposalType === 3) restore = fctx.getImageData(0, 0, gw, gh);

        patch.width = f.dims.width; patch.height = f.dims.height;
        pctx.putImageData(new ImageData(new Uint8ClampedArray(f.patch), f.dims.width, f.dims.height), 0, 0);
        fctx.drawImage(patch, f.dims.left, f.dims.top);

        const snap = document.createElement('canvas'); snap.width = w; snap.height = h;
        snap.getContext('2d')!.drawImage(full, 0, 0, w, h);
        frames.push(snap);
        delays.push(f.delay);
    }
    return { frames, delays: normalizeDelays(delays), width: w, height: h };
}

// ─── Disegno ──────────────────────────────────────────────────────────────────

function roundRectPath(ctx: CanvasRenderingContext2D, w: number, h: number, r: number) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(rr, 0); ctx.lineTo(w - rr, 0); ctx.arcTo(w, 0, w, rr, rr);
    ctx.lineTo(w, h - rr); ctx.arcTo(w, h, w - rr, h, rr);
    ctx.lineTo(rr, h); ctx.arcTo(0, h, 0, h - rr, rr);
    ctx.lineTo(0, rr); ctx.arcTo(0, 0, rr, 0, rr);
    ctx.closePath();
}

/** Come Konva dispone un gruppo: sposta, ruota, poi scala (stesso ordine dell'editor). */
export function drawLayerFrame(ctx: CanvasRenderingContext2D, layer: ImageLayer, frame: CanvasImageSource) {
    ctx.save();
    ctx.translate(layer.x, layer.y);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.scale(layer.scaleX, layer.scaleY);
    ctx.globalAlpha = layer.opacity;
    if (layer.cornerRadius > 0) { roundRectPath(ctx, layer.width, layer.height, layer.cornerRadius); ctx.clip(); }
    ctx.drawImage(frame, 0, 0, layer.width, layer.height);
    ctx.restore();
}

/** Disegna un fotogramma «a coprire» tutta la storia (come lo sfondo immagine con fit cover). */
function drawCover(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number) {
    const k = Math.max(STORY_W / sw, STORY_H / sh);
    const w = sw * k, h = sh * k;
    ctx.drawImage(src, (STORY_W - w) / 2, (STORY_H - h) / 2, w, h);
}

async function ensureFonts(families: string[]): Promise<void> {
    if (!document.fonts) return;
    await Promise.all(families.flatMap((f) => [document.fonts.load(`700 48px "${f}"`), document.fonts.load(`400 48px "${f}"`)]));
    await document.fonts.ready;
}

/** Disegna con Konva (fuori schermo, a 1080×1920) una porzione della slide e la restituisce come tela con trasparenza. */
async function renderSliceCanvas(slide: Slide): Promise<HTMLCanvasElement> {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-99999px;top:0;width:1080px;height:1920px;pointer-events:none;';
    document.body.appendChild(host);
    const root = createRoot(host);
    const ref = { current: null as Konva.Stage | null };
    try {
        flushSync(() => root.render(<SlideStage slide={slide} scale={1} stageRef={ref} />));
        await nextPaint();
        if (!ref.current) throw new Error('La tela non è pronta');
        return ref.current.toCanvas({ pixelRatio: 1 }) as HTMLCanvasElement;
    } finally {
        root.unmount();
        host.remove();
    }
}

type Piece = { kind: 'static'; canvas: HTMLCanvasElement } | { kind: 'gif'; layer: ImageLayer; gif: GifAnimation };
const CLEAR = 'rgba(0,0,0,0)';

// ─── Video di sfondo ──────────────────────────────────────────────────────────

interface LoadedVideo { el: HTMLVideoElement; duration: number; buffer: ArrayBuffer; revoke: () => void }

async function loadVideo(url: string): Promise<LoadedVideo> {
    const buffer = await fetchMediaBuffer(url);
    const type = getLocalFile(url)?.type || 'video/mp4';
    const objectUrl = URL.createObjectURL(new Blob([buffer.slice(0)], { type }));
    const el = document.createElement('video');
    el.muted = true; el.playsInline = true; el.preload = 'auto';
    el.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Il video non si carica.')), 30_000);
        el.onloadedmetadata = () => { clearTimeout(timer); resolve(); };
        el.onerror = () => { clearTimeout(timer); reject(new Error('Il browser non riesce a leggere questo video (prova un MP4 H.264).')); };
    });
    if (!el.videoWidth || !el.videoHeight) throw new Error('Il video non ha immagini leggibili.');
    return { el, duration: el.duration, buffer, revoke: () => URL.revokeObjectURL(objectUrl) };
}

function seekTo(el: HTMLVideoElement, t: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Il video non risponde.')), 15_000);
        el.onseeked = () => { clearTimeout(timer); resolve(); };
        el.onerror = () => { clearTimeout(timer); reject(new Error('Errore nella lettura del video.')); };
        el.currentTime = t;
    });
}

/** L'audio del video (tra start ed end) come buffer PCM; null se non c'è o il browser non lo decodifica. */
async function decodeAudio(buffer: ArrayBuffer, start: number, end: number): Promise<AudioBuffer | null> {
    try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return null;
        const ctx: AudioContext = new Ctx();
        const full = await ctx.decodeAudioData(buffer.slice(0));
        await ctx.close();
        if (!full.length) return null;
        const sr = full.sampleRate;
        const from = Math.floor(start * sr), to = Math.min(full.length, Math.floor(end * sr));
        if (to <= from) return null;
        const channels = Math.min(2, full.numberOfChannels);
        const OfflineCtx = (window as any).OfflineAudioContext;
        const out = new OfflineCtx(channels, to - from, sr).createBuffer(channels, to - from, sr) as AudioBuffer;
        for (let c = 0; c < channels; c++) out.copyToChannel(full.getChannelData(c).subarray(from, to), c);
        return out;
    } catch {
        return null;
    }
}

// ─── Esportazione ─────────────────────────────────────────────────────────────

export async function renderSlideToMp4(slide: Slide, opts: VideoExportOptions = {}): Promise<VideoExportResult> {
    const { onProgress, signal } = opts;
    if (!videoExportSupported()) throw new Error('Questo browser non sa esportare video: usa Chrome, Edge o Safari aggiornati.');
    const notes: string[] = [];
    const cleanups: (() => void)[] = [];

    try {
        // 1. Materiali: video di sfondo, GIF, caratteri e immagini
        onProgress?.(0, 1, 'Leggo i materiali');
        const gifLayers = slide.layers.filter(isAnimatedLayer);
        const gifs = new Map<string, GifAnimation>();
        for (const l of gifLayers) {
            checkAbort(signal);
            if (!gifs.has(l.url)) gifs.set(l.url, await decodeGif(await fetchMediaBuffer(l.url)));
        }
        onProgress?.(0, 1, 'GIF pronte');
        let video: LoadedVideo | null = null;
        if (slide.background.type === 'video') { video = await loadVideo(slide.background.url); cleanups.push(video.revoke); }

        onProgress?.(0, 1, 'Video pronto');
        const trim = slide.background.type === 'video' ? trimRange(slide.background.trimStart, slide.background.trimEnd, video!.duration) : { start: 0, end: 0 };
        const duration = slideDurationSeconds(slide, { videoDuration: video?.duration, gifCycles: Array.from(gifs.values()).map((g) => cycleSeconds(g.delays)) });
        const total = frameCount(duration);
        if (total > VIDEO_FPS * 60) throw new Error('La storia dura più di 60 secondi.');

        const staticLayers = slide.layers.filter((l) => !l.hidden);
        await preloadImages(staticLayers.flatMap((l) => (l.type === 'image' && !animated(l) ? [l.url] : [])));
        await ensureFonts(Array.from(new Set(staticLayers.flatMap((l) => (l.type === 'text' ? [l.fontFamily] : [])))));

        onProgress?.(0, 1, 'Caratteri e immagini pronti');
        // 2. Pezzi fermi: lo sfondo non video e ogni gruppo di livelli fra una GIF e l'altra
        const pieces: Piece[] = [];
        let backdrop: HTMLCanvasElement | null = null;
        if (slide.background.type !== 'video') backdrop = await renderSliceCanvas({ ...slide, layers: [] });
        let run: Slide['layers'] = [];
        const flush = async () => {
            if (run.length === 0) return;
            pieces.push({ kind: 'static', canvas: await renderSliceCanvas({ ...slide, background: { type: 'color', color: CLEAR }, layers: run }) });
            run = [];
        };
        for (const l of slide.layers) {
            if (l.hidden) continue;
            if (isAnimatedLayer(l)) { await flush(); pieces.push({ kind: 'gif', layer: l, gif: gifs.get(l.url)! }); }
            else run.push(l);
        }
        await flush();
        checkAbort(signal);

        onProgress?.(0, 1, 'Disegno i livelli');
        // 3. Codificatore e file
        const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
        const target = new ArrayBufferTarget();
        const VE = (window as any).VideoEncoder, AE = (window as any).AudioEncoder;
        const videoConfig = { codec: 'avc1.640028', width: STORY_W, height: STORY_H, bitrate: 6_000_000, framerate: VIDEO_FPS, avc: { format: 'avc' } };
        let support = await VE.isConfigSupported(videoConfig);
        let cfg = videoConfig;
        if (!support?.supported) { cfg = { ...videoConfig, codec: 'avc1.4d0028' }; support = await VE.isConfigSupported(cfg); }
        if (!support?.supported) throw new Error('Questo browser non sa codificare video H.264: usa Chrome, Edge o Safari aggiornati.');

        // Audio: solo se il video di sfondo ne ha e il browser sa scriverlo in AAC
        let audio: AudioBuffer | null = null;
        let audioCfg: Record<string, unknown> | null = null;
        if (video && AE) {
            audio = await decodeAudio(video.buffer, trim.start, Math.min(trim.end, trim.start + duration));
            if (audio) {
                audioCfg = { codec: 'mp4a.40.2', sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels, bitrate: 128_000 };
                const ok = await AE.isConfigSupported(audioCfg);
                if (!ok?.supported) { audio = null; audioCfg = null; notes.push('Il browser non sa scrivere l\'audio: il video esce senza suono.'); }
            } else {
                notes.push('Il video non ha audio leggibile: la storia esce senza suono.');
            }
        }

        const muxer = new Muxer({
            target,
            video: { codec: 'avc', width: STORY_W, height: STORY_H, frameRate: VIDEO_FPS },
            ...(audio && audioCfg ? { audio: { codec: 'aac', sampleRate: audio.sampleRate, numberOfChannels: audio.numberOfChannels } } : {}),
            fastStart: 'in-memory',
        } as any);
        let encodeError: Error | null = null;
        const encoder = new VE({ output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta), error: (e: Error) => { encodeError = e; } });
        encoder.configure(cfg);

        // 4. Fotogrammi
        const canvas = document.createElement('canvas');
        canvas.width = STORY_W; canvas.height = STORY_H;
        const ctx = canvas.getContext('2d', { alpha: false })!;
        const frameUs = 1_000_000 / VIDEO_FPS;
        const lastVideoT = video ? Math.max(trim.start, Math.min(trim.end, video.duration) - 0.05) : 0;

        for (let i = 0; i < total; i++) {
            checkAbort(signal);
            if (encodeError) throw encodeError;
            const t = i / VIDEO_FPS;
            ctx.globalAlpha = 1;
            if (video) {
                await seekTo(video.el, Math.min(lastVideoT, trim.start + t));
                ctx.fillStyle = '#000'; ctx.fillRect(0, 0, STORY_W, STORY_H);
                drawCover(ctx, video.el, video.el.videoWidth, video.el.videoHeight);
            } else if (backdrop) {
                ctx.drawImage(backdrop, 0, 0);
            }
            for (const p of pieces) {
                if (p.kind === 'static') ctx.drawImage(p.canvas, 0, 0);
                else drawLayerFrame(ctx, p.layer, p.gif.frames[gifFrameIndexAt(p.gif.delays, t)]);
            }
            const frame = new (window as any).VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round(frameUs) });
            encoder.encode(frame, { keyFrame: i % (VIDEO_FPS * 2) === 0 });
            frame.close();
            while (encoder.encodeQueueSize > 6) await tick();
            if (i % 5 === 0) { onProgress?.(i + 1, total, 'Creo il video'); await tick(); }
        }
        await encoder.flush();
        encoder.close();
        if (encodeError) throw encodeError;

        // 5. Audio
        if (audio && audioCfg) {
            onProgress?.(total, total, 'Scrivo l\'audio');
            let aerr: Error | null = null;
            const aenc = new AE({ output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta), error: (e: Error) => { aerr = e; } });
            aenc.configure(audioCfg);
            const sr = audio.sampleRate, ch = audio.numberOfChannels, step = 4096;
            const maxFrames = Math.min(audio.length, Math.floor(duration * sr));
            for (let off = 0; off < maxFrames; off += step) {
                const n = Math.min(step, maxFrames - off);
                const data = new Float32Array(n * ch);
                for (let c = 0; c < ch; c++) data.set(audio.getChannelData(c).subarray(off, off + n), c * n);
                const ad = new (window as any).AudioData({ format: 'f32-planar', sampleRate: sr, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round((off / sr) * 1_000_000), data });
                aenc.encode(ad); ad.close();
                while (aenc.encodeQueueSize > 8) await tick();
            }
            await aenc.flush(); aenc.close();
            if (aerr) throw aerr;
        }

        muxer.finalize();
        return { blob: new Blob([target.buffer], { type: 'video/mp4' }), durationSeconds: duration, hasAudio: !!audio, notes };
    } finally {
        cleanups.forEach((fn) => fn());
    }
}
