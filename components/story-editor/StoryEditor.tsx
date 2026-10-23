'use client';

/**
 * components/story-editor/StoryEditor.tsx
 *
 * L'editor delle storie (ispirato a Storrito): barra a sinistra con gli strumenti, tela 9:16 con sovrapposizione
 * dell'interfaccia di Instagram e guide magnetiche, pannello proprietà a destra, striscia delle slide in basso.
 * Non conosce Firebase: caricamento file e salvataggio arrivano dal contenitore (props), così si può provare da solo.
 */
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import {
    Camera, ChevronLeft, Clapperboard, Copy, Download, ImageIcon, LayoutTemplate, Loader2, Sparkles, Palette as PaletteIcon, Plus, Redo2, Save, Shapes, Smile, Sticker, Trash2, Type, Undo2, ZoomIn, ZoomOut,
} from 'lucide-react';
import type Konva from 'konva';
import { editorReducer, initialState } from '@/lib/story-editor/reducer';
import { cloneSlide, emptyDesign, makeImage, makeSlide, uid } from '@/lib/story-editor/factory';
import { fontsStylesheetUrl, STORY_FONTS } from '@/lib/story-editor/fonts';
import { DEFAULT_PALETTE, type Palette } from '@/lib/story-editor/templates';
import { SAFE_BOTTOM, SAFE_TOP, STORY_H, STORY_W, type Layer, type StoryDesign } from '@/lib/story-editor/types';
import { SlideStage } from './SlideStage';
import { loadImage } from './image-cache';
import { AiPanel } from './ai-panel';
import type { ClientMediaItem, StockItem } from '@/lib/story-editor/stock';
import { renderSlideToJpeg, renderSlidesToJpeg } from './export';
import { BackgroundPanel, EmojiPanel, MediaPanel, ShapesPanel, StickersPanel, StockPanel, TemplatesPanel, TextPanel, type PanelKey, type UploadedMedia } from './panels';
import { PropertiesPanel } from './properties';
import { cn } from '@/lib/utils';
import { authFetch } from '@/lib/client-api-auth';

export interface SavePayload { design: StoryDesign; title: string; igStories: boolean; fbStories: boolean; storyLink: string; onProgress: (message: string) => void }

interface Props {
    clientName: string;
    backHref: string;
    initialDesign?: StoryDesign | null;
    initialTitle?: string;
    initialChannels?: { igStories: boolean; fbStories: boolean };
    initialStoryLink?: string;
    palette?: Palette;
    /** Il cliente di cui si legge la galleria nel pannello Media; senza, la sezione non c'è. */
    clientId?: string;
    onUploadFiles: (files: File[]) => Promise<UploadedMedia[]>;
    /** «Salva nel PED»: se manca, il pulsante non c'è (prova da soli dell'editor). */
    onSave?: (p: SavePayload) => Promise<void>;
}

const RAIL: { key: PanelKey; label: string; icon: React.ElementType }[] = [
    { key: 'templates', label: 'Modelli', icon: LayoutTemplate },
    { key: 'text', label: 'Testo', icon: Type },
    { key: 'stickers', label: 'Sticker', icon: Sticker },
    { key: 'emoji', label: 'Emoji', icon: Smile },
    { key: 'shapes', label: 'Forme', icon: Shapes },
    { key: 'background', label: 'Sfondo', icon: PaletteIcon },
    { key: 'media', label: 'Media', icon: ImageIcon },
    { key: 'gif', label: 'GIF', icon: Clapperboard },
    { key: 'photos', label: 'Foto', icon: Camera },
    { key: 'ai', label: 'AI', icon: Sparkles },
];

function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Sovrapposizione dell'interfaccia di Instagram (non fa parte dell'immagine esportata). */
function InstagramOverlay({ name, slides, index, width, height }: { name: string; slides: number; index: number; width: number; height: number }) {
    const k = width / STORY_W;
    return (
        <div className="pointer-events-none absolute inset-0 text-white" style={{ width, height }} aria-hidden="true">
            <div className="absolute inset-x-0 top-0" style={{ height: SAFE_TOP * k, background: 'linear-gradient(rgba(0,0,0,0.45), transparent)' }} />
            <div className="absolute inset-x-0 bottom-0" style={{ height: SAFE_BOTTOM * k, background: 'linear-gradient(transparent, rgba(0,0,0,0.5))' }} />
            <div className="absolute flex gap-1" style={{ left: 24 * k, right: 24 * k, top: 24 * k }}>
                {Array.from({ length: slides }).map((_, i) => (
                    <div key={i} className="h-[3px] flex-1 rounded-full bg-white/40"><div className="h-full rounded-full bg-white" style={{ width: i < index ? '100%' : i === index ? '40%' : '0%' }} /></div>
                ))}
            </div>
            <div className="absolute flex items-center gap-2" style={{ left: 30 * k, top: 70 * k }}>
                <div className="flex items-center justify-center rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 font-bold" style={{ width: 88 * k, height: 88 * k, fontSize: 40 * k }}>{name.charAt(0).toUpperCase()}</div>
                <span className="font-semibold" style={{ fontSize: 38 * k }}>{name.toLowerCase().replace(/\s+/g, '')}</span>
                <span className="opacity-70" style={{ fontSize: 34 * k }}>53 min</span>
            </div>
            <div className="absolute flex items-center gap-3" style={{ left: 30 * k, right: 30 * k, bottom: 70 * k }}>
                <div className="flex-1 rounded-full border border-white/70 px-4 py-2 opacity-90" style={{ fontSize: 36 * k, height: 110 * k, display: 'flex', alignItems: 'center' }}>Invia messaggio</div>
                <span style={{ fontSize: 60 * k }}>♡</span><span style={{ fontSize: 56 * k }}>➤</span>
            </div>
        </div>
    );
}

export function StoryEditor({ clientId, clientName, backHref, initialDesign, initialTitle = '', initialChannels = { igStories: true, fbStories: false }, initialStoryLink = '', palette = DEFAULT_PALETTE, onUploadFiles, onSave }: Props) {
    const [state, dispatch] = useReducer(editorReducer, initialDesign || emptyDesign(), (d) => initialState(d));
    const [panel, setPanel] = useState<PanelKey | null>('templates');
    const [overlay, setOverlay] = useState(false);
    const [snap, setSnap] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [fontsVersion, setFontsVersion] = useState(0);
    const [uploaded, setUploaded] = useState<UploadedMedia[]>([]);
    const [clientMedia, setClientMedia] = useState<{ items: ClientMediaItem[]; loading: boolean; error: string } | null>(clientId ? { items: [], loading: false, error: '' } : null);
    const clientMediaLoaded = useRef(false);
    const [title, setTitle] = useState(initialTitle);
    const [channels, setChannels] = useState(initialChannels);
    const [storyLink, setStoryLink] = useState(initialStoryLink);
    const [saveOpen, setSaveOpen] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const stageHost = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage | null>(null);
    const [fit, setFit] = useState(0.3);

    const slide = state.design.slides.find((s) => s.id === state.slideId)!;
    const slideIndex = state.design.slides.findIndex((s) => s.id === state.slideId);
    const layer = slide.layers.find((l) => l.id === state.selectedId) || null;

    // Caratteri: si caricano una volta e si ridisegna quando sono pronti
    useEffect(() => {
        if (!document.querySelector('link[data-story-fonts]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet'; link.href = fontsStylesheetUrl(); link.dataset.storyFonts = '1';
            document.head.appendChild(link);
        }
        let alive = true;
        Promise.all(STORY_FONTS.flatMap((f) => [document.fonts.load(`700 40px "${f}"`), document.fonts.load(`400 40px "${f}"`)]))
            .catch(() => undefined)
            .finally(() => { if (alive) setFontsVersion((v) => v + 1); });
        return () => { alive = false; };
    }, []);

    // La tela si adatta allo spazio disponibile
    useEffect(() => {
        const el = stageHost.current;
        if (!el) return;
        const compute = () => setFit(Math.max(0.1, Math.min((el.clientWidth - 48) / STORY_W, (el.clientHeight - 48) / STORY_H)));
        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const scale = fit * zoom;

    // La galleria del cliente si legge la prima volta che si apre il pannello Media
    useEffect(() => {
        if (panel !== 'media' || !clientId || clientMediaLoaded.current) return;
        clientMediaLoaded.current = true;
        setClientMedia({ items: [], loading: true, error: '' });
        authFetch(`/api/stories/client-media?clientId=${encodeURIComponent(clientId)}`)
            .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Non riesco a leggere i media del cliente.'); return d.items as ClientMediaItem[]; })
            .then((items) => setClientMedia({ items, loading: false, error: '' }))
            .catch((e) => { clientMediaLoaded.current = false; setClientMedia({ items: [], loading: false, error: e.message }); });
    }, [panel, clientId]);

    const add = useCallback((l: Layer) => dispatch({ type: 'ADD_LAYER', layer: l }), []);
    const update = useCallback((id: string, patch: Partial<Layer>, key?: string) => dispatch({ type: 'UPDATE_LAYER', layerId: id, patch, key }), []);

    // Scorciatoie da tastiera (non quando si scrive in un campo)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
            const mod = e.metaKey || e.ctrlKey;
            if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); dispatch({ type: e.shiftKey ? 'REDO' : 'UNDO' }); return; }
            if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); dispatch({ type: 'REDO' }); return; }
            if (!state.selectedId) return;
            if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); dispatch({ type: 'DUPLICATE_LAYER', layerId: state.selectedId, newId: uid('d') }); return; }
            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); dispatch({ type: 'REMOVE_LAYER', layerId: state.selectedId }); return; }
            const step = e.shiftKey ? 10 : 1;
            const l = slide.layers.find((x) => x.id === state.selectedId);
            if (!l || l.locked) return;
            const moves: Record<string, Partial<Layer>> = { ArrowLeft: { x: l.x - step }, ArrowRight: { x: l.x + step }, ArrowUp: { y: l.y - step }, ArrowDown: { y: l.y + step } };
            if (moves[e.key]) { e.preventDefault(); dispatch({ type: 'UPDATE_LAYER', layerId: l.id, patch: moves[e.key], key: `nudge:${l.id}` }); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [state.selectedId, slide.layers]);

    // Avviso se si esce con modifiche non salvate
    useEffect(() => {
        if (!state.dirty) return;
        const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', h);
        return () => window.removeEventListener('beforeunload', h);
    }, [state.dirty]);

    const upload = async (files: File[]) => {
        const added = await onUploadFiles(files);
        setUploaded((prev) => [...added, ...prev]);
        return added;
    };

    const addImage = (m: UploadedMedia) => add(makeImage(m.url, m.width || 1080, m.height || 1080, { source: 'upload' }));
    const addStock = (i: StockItem, source: 'gif' | 'stock') => {
        // Le GIF entrano a 720 px di larghezza (non a tutta tela); le foto si adattano alla storia
        const w = source === 'gif' ? 720 : i.width, h = source === 'gif' ? Math.round((720 * i.height) / i.width) : i.height;
        add(makeImage(i.url, w, h, { source }));
    };
    const addAiImage = async (url: string) => {
        const img = await loadImage(url);
        add(makeImage(url, img?.naturalWidth || 1080, img?.naturalHeight || 1920, { source: 'stock' }));
    };
    const aiBackground = (url: string) => dispatch({ type: 'SET_BACKGROUND', background: { type: 'image', url, fit: 'cover', blur: 0, dim: 0 } });
    const removeBg = async (layer: Layer) => {
        if (layer.type !== 'image') return;
        setBusy('Tolgo lo sfondo…'); setMessage('');
        try {
            const res = await authFetch('/api/stories/magnific/remove-bg', { method: 'POST', body: JSON.stringify({ imageUrl: layer.url }) });
            const d = await res.json().catch(() => ({}));
            if (d.configured === false) throw new Error('Servizio non ancora attivo: manca la chiave MAGNIFIC_API_KEY su Vercel.');
            if (!res.ok || !d.url) throw new Error(d.error || 'Non sono riuscito a togliere lo sfondo.');
            await loadImage(d.url); // pronta in cache prima di sostituirla
            update(layer.id, { url: d.url } as Partial<Layer>);
            setMessage('Sfondo tolto.');
        } catch (e: any) {
            setMessage(e?.message || 'Non sono riuscito a togliere lo sfondo.');
        } finally { setBusy(null); }
    };
    const stockBackground = (i: StockItem) => dispatch({ type: 'SET_BACKGROUND', background: { type: 'image', url: i.url, fit: 'cover', blur: 0, dim: 0 } });
    const addClientImage = async (m: ClientMediaItem) => {
        const img = await loadImage(m.url); // serve la misura vera dell'immagine
        add(makeImage(m.url, img?.naturalWidth || 1080, img?.naturalHeight || 1080, { source: 'upload' }));
    };
    const clientImageBackground = (m: ClientMediaItem) => dispatch({ type: 'SET_BACKGROUND', background: { type: 'image', url: m.url, fit: 'cover', blur: 0, dim: 0 } });
    const useBackground = (m: UploadedMedia) => dispatch({ type: 'SET_BACKGROUND', background: { type: 'image', url: m.url, fit: 'cover', blur: 0, dim: 0 } });

    const downloadCurrent = async () => {
        setBusy('Preparo l\'immagine…');
        try { download(await renderSlideToJpeg(slide), `storia-${slideIndex + 1}.jpg`); } finally { setBusy(null); }
    };
    const downloadAll = async () => {
        setBusy('Preparo le immagini…');
        try {
            const blobs = await renderSlidesToJpeg(state.design.slides, (d, t) => setBusy(`Preparo le immagini ${d}/${t}…`));
            blobs.forEach((b, i) => setTimeout(() => download(b, `storia-${i + 1}.jpg`), i * 300));
        } finally { setBusy(null); }
    };

    const save = async () => {
        if (!onSave) return;
        setBusy('Salvo…'); setMessage('');
        try {
            await onSave({ design: state.design, title: title.trim() || `Storia del ${new Date().toLocaleDateString('it-IT')}`, igStories: channels.igStories, fbStories: channels.fbStories, storyLink: storyLink.trim(), onProgress: (m) => setBusy(m) });
            dispatch({ type: 'MARK_SAVED' });
            setSaveOpen(false);
            setMessage('Salvato nel PED come bozza.');
        } catch (e: any) {
            setMessage(e?.message || 'Non siamo riusciti a salvare.');
        } finally { setBusy(null); }
    };

    const slideThumbs = useMemo(() => state.design.slides, [state.design.slides]);

    return (
        <div className="flex h-[calc(100vh-7rem)] min-h-[560px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#0b0f17] text-slate-100">
            {/* Barra superiore */}
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-[#0f1520] px-3 py-2">
                <Link href={backHref} className="flex items-center gap-1 text-sm text-slate-300 hover:text-white"><ChevronLeft className="h-4 w-4" />Indietro</Link>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nome della storia" aria-label="Nome della storia"
                    className="w-52 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm outline-none focus:border-sky-500" />
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} className="accent-sky-500" /> Interfaccia Instagram
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} className="accent-sky-500" /> Guide magnetiche
                </label>
                <div className="ml-auto flex items-center gap-1.5">
                    <TopBtn title="Annulla (⌘Z)" disabled={state.past.length === 0} onClick={() => dispatch({ type: 'UNDO' })}><Undo2 className="h-4 w-4" /></TopBtn>
                    <TopBtn title="Ripeti (⇧⌘Z)" disabled={state.future.length === 0} onClick={() => dispatch({ type: 'REDO' })}><Redo2 className="h-4 w-4" /></TopBtn>
                    <TopBtn title="Riduci" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}><ZoomOut className="h-4 w-4" /></TopBtn>
                    <span className="w-10 text-center text-xs text-slate-400">{Math.round(zoom * 100)}%</span>
                    <TopBtn title="Ingrandisci" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}><ZoomIn className="h-4 w-4" /></TopBtn>
                    <TopBtn title="Scarica questa slide (JPG)" onClick={downloadCurrent}><Download className="h-4 w-4" /></TopBtn>
                    {state.design.slides.length > 1 && <button type="button" onClick={downloadAll} className="rounded-md border border-slate-700 px-2 py-1.5 text-xs hover:bg-slate-800">Scarica tutte</button>}
                    {onSave && (
                        <div className="relative">
                            <button type="button" onClick={() => { if (!saveOpen && !storyLink) { const sticker = state.design.slides.flatMap((s) => s.layers).find((l) => l.type === 'sticker' && l.sticker === 'link'); const t = sticker && sticker.type === 'sticker' ? sticker.text.trim() : ''; if (t.includes('.')) setStoryLink(/^https?:\/\//i.test(t) ? t : `https://${t}`); } setSaveOpen((o) => !o); }} className="flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-sky-400">
                                <Save className="h-4 w-4" /> Salva nel PED
                            </button>
                            {saveOpen && (
                                <div className="absolute right-0 z-30 mt-2 w-80 space-y-3 rounded-lg border border-slate-700 bg-[#0f1520] p-4 shadow-xl">
                                    <p className="text-sm font-semibold">Salva come bozza nel PED</p>
                                    <p className="text-xs text-slate-400">Ogni slide diventa una storia. Poi la mandi al cliente per l&apos;approvazione, come gli altri contenuti.</p>
                                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={channels.igStories} onChange={(e) => setChannels((c) => ({ ...c, igStories: e.target.checked }))} className="accent-sky-500" /> Storie Instagram (pubblicazione automatica)</label>
                                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={channels.fbStories} onChange={(e) => setChannels((c) => ({ ...c, fbStories: e.target.checked }))} className="accent-sky-500" /> Storie Facebook (da pubblicare a mano)</label>
                                    <label className="block space-y-1">
                                        <span className="text-xs font-semibold text-slate-300">Link della storia</span>
                                        <input type="url" value={storyLink} onChange={(e) => setStoryLink(e.target.value)} placeholder="https://…"
                                            className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm outline-none focus:border-sky-500" />
                                        <span className="block text-[11px] text-slate-400">Resta salvato nel contenuto. Lo sticker Link vero lo aggiungi dall&apos;app di Instagram: l&apos;adesivo disegnato non è cliccabile.</span>
                                    </label>
                                    <button type="button" onClick={save} disabled={!!busy} className="w-full rounded-md bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-60">
                                        {busy || 'Salva'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {(busy || message) && (
                <div role="status" className="flex items-center gap-2 border-b border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{busy || message}
                </div>
            )}

            <div className="flex min-h-0 flex-1">
                {/* Barra strumenti */}
                <nav className="flex w-[72px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-slate-800 bg-[#0f1520] p-1.5" aria-label="Strumenti">
                    {RAIL.map(({ key, label, icon: Icon }) => (
                        <button key={key} type="button" aria-pressed={panel === key} onClick={() => setPanel((p) => (p === key ? null : key))}
                            className={cn('flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px]', panel === key ? 'bg-sky-500/20 text-sky-200' : 'text-slate-300 hover:bg-slate-800')}>
                            <Icon className="h-5 w-5" />{label}
                        </button>
                    ))}
                </nav>

                {panel && (
                    <aside className="w-[300px] shrink-0 overflow-y-auto border-r border-slate-800 bg-[#0f1520] p-4">
                        {panel === 'templates' && <TemplatesPanel palette={palette} fontsVersion={fontsVersion} onApply={(s) => dispatch({ type: 'APPLY_SLIDE', slide: cloneSlide(s) })} />}
                        {panel === 'text' && <TextPanel palette={palette} onAdd={add} />}
                        {panel === 'stickers' && <StickersPanel onAdd={add} />}
                        {panel === 'emoji' && <EmojiPanel onAdd={add} />}
                        {panel === 'shapes' && <ShapesPanel palette={palette} onAdd={add} />}
                        {panel === 'background' && <BackgroundPanel background={slide.background} palette={palette} onUploadFiles={upload} onChange={(b, key) => dispatch({ type: 'SET_BACKGROUND', background: b, key })} />}
                        {panel === 'media' && <MediaPanel uploaded={uploaded} onUploadFiles={upload} onAddImage={addImage} onUseAsBackground={useBackground} clientMedia={clientMedia} onAddClientImage={addClientImage} onClientImageAsBackground={clientImageBackground} />}
                        {panel === 'gif' && <StockPanel kind="gif" onAdd={(i) => addStock(i, 'gif')} />}
                        {panel === 'ai' && <AiPanel onAdd={addAiImage} onBackground={aiBackground} />}
                        {panel === 'photos' && <StockPanel kind="photo" onAdd={(i) => addStock(i, 'stock')} onBackground={stockBackground} />}
                    </aside>
                )}

                {/* Tela */}
                <main ref={stageHost} className="relative flex min-w-0 flex-1 items-center justify-center overflow-auto bg-[#05070b]">
                    <div className="relative shrink-0 shadow-2xl" style={{ width: STORY_W * scale, height: STORY_H * scale }}>
                        <SlideStage slide={slide} scale={scale} interactive selectedId={state.selectedId} snap={snap} fontsVersion={fontsVersion} stageRef={stageRef}
                            onSelect={(id) => dispatch({ type: 'SELECT_LAYER', layerId: id })} onChange={update} />
                        {overlay && <InstagramOverlay name={clientName} slides={state.design.slides.length} index={slideIndex} width={STORY_W * scale} height={STORY_H * scale} />}
                        {!overlay && (
                            <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/25" style={{ top: SAFE_TOP * scale }} title="Margine sicuro in alto" aria-hidden="true" />
                        )}
                        {!overlay && (
                            <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/25" style={{ top: (STORY_H - SAFE_BOTTOM) * scale }} title="Margine sicuro in basso" aria-hidden="true" />
                        )}
                    </div>
                </main>

                {/* Proprietà */}
                <aside className="w-[290px] shrink-0 overflow-y-auto border-l border-slate-800 bg-[#0f1520] p-4" aria-label="Proprietà">
                    <PropertiesPanel slide={slide} layer={layer} onSelect={(id) => dispatch({ type: 'SELECT_LAYER', layerId: id })} onUpdate={update}
                        onDuplicate={(id) => dispatch({ type: 'DUPLICATE_LAYER', layerId: id, newId: uid('d') })} onDelete={(id) => dispatch({ type: 'REMOVE_LAYER', layerId: id })}
                        onMove={(id, d) => dispatch({ type: 'MOVE_LAYER', layerId: id, direction: d })} onRemoveBackground={removeBg} />
                </aside>
            </div>

            {/* Striscia delle slide */}
            <div className="flex items-center gap-3 overflow-x-auto border-t border-slate-800 bg-[#0f1520] px-3 py-2">
                {slideThumbs.map((s, i) => (
                    <div key={s.id} className="shrink-0">
                        <button type="button" aria-label={`Slide ${i + 1}`} aria-current={s.id === state.slideId} onClick={() => dispatch({ type: 'SELECT_SLIDE', slideId: s.id })}
                            className={cn('block overflow-hidden rounded-md border-2', s.id === state.slideId ? 'border-sky-500' : 'border-slate-700 hover:border-slate-500')}>
                            <SlideStage slide={s} scale={0.07} fontsVersion={fontsVersion} />
                        </button>
                        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                            <span>{i + 1}</span>
                            <span className="flex gap-1">
                                <button type="button" title="Sposta a sinistra" disabled={i === 0} onClick={() => dispatch({ type: 'MOVE_SLIDE', slideId: s.id, toIndex: i - 1 })} className="px-0.5 hover:text-white disabled:opacity-30">‹</button>
                                <button type="button" title="Sposta a destra" disabled={i === slideThumbs.length - 1} onClick={() => dispatch({ type: 'MOVE_SLIDE', slideId: s.id, toIndex: i + 1 })} className="px-0.5 hover:text-white disabled:opacity-30">›</button>
                                <button type="button" title="Duplica slide" onClick={() => dispatch({ type: 'DUPLICATE_SLIDE', slideId: s.id, newId: uid('slide'), idFor: (id) => `${id}-${uid('c')}` })} className="hover:text-white"><Copy className="h-3 w-3" /></button>
                                <button type="button" title="Elimina slide" disabled={slideThumbs.length <= 1} onClick={() => dispatch({ type: 'REMOVE_SLIDE', slideId: s.id })} className="hover:text-red-300 disabled:opacity-30"><Trash2 className="h-3 w-3" /></button>
                            </span>
                        </div>
                    </div>
                ))}
                <button type="button" onClick={() => dispatch({ type: 'ADD_SLIDE', slide: makeSlide({ name: `Slide ${slideThumbs.length + 1}`, background: { ...slide.background } })})}
                    className="flex h-[134px] w-[76px] shrink-0 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-slate-600 text-xs text-slate-300 hover:border-sky-500">
                    <Plus className="h-5 w-5" />Slide
                </button>
            </div>
        </div>
    );
}

function TopBtn({ children, onClick, title, disabled }: { children: React.ReactNode; onClick: () => void; title: string; disabled?: boolean }) {
    return (
        <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-30">
            {children}
        </button>
    );
}
