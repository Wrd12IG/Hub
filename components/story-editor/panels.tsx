'use client';

/**
 * components/story-editor/panels.tsx
 *
 * I pannelli della barra a sinistra: modelli, testo, sticker, emoji, forme, sfondo, media.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, Upload } from 'lucide-react';
import { STORY_TEMPLATES, type Palette } from '@/lib/story-editor/templates';
import { STICKER_DEFAULTS, makeEmoji, makeShape, makeSticker, makeText } from '@/lib/story-editor/factory';
import type { Background, Layer, Slide, StickerKind } from '@/lib/story-editor/types';
import { viaProxy } from '@/lib/story-editor/proxy';
import type { ClientMediaItem, StockItem } from '@/lib/story-editor/stock';
import { SlideStage } from './SlideStage';
import { EMOJI_GROUPS } from './emoji-list';
import { ColorField, Field, Range, inputCls } from './ui';

export type PanelKey = 'templates' | 'text' | 'stickers' | 'emoji' | 'shapes' | 'background' | 'media' | 'gif' | 'photos';

export interface UploadedMedia { url: string; filename: string; width: number; height: number; kind: 'image' | 'video'; temporary?: boolean }

const Title = ({ children }: { children: React.ReactNode }) => <h3 className="mb-3 text-sm font-bold text-slate-100">{children}</h3>;
const Btn = ({ children, onClick, className = '' }: { children: React.ReactNode; onClick: () => void; className?: string }) => (
    <button type="button" onClick={onClick} className={`rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-left text-sm text-slate-100 hover:border-sky-500 hover:bg-slate-800 ${className}`}>{children}</button>
);

export function TemplatesPanel({ palette, onApply, fontsVersion = 0 }: { palette: Palette; onApply: (slide: Slide) => void; fontsVersion?: number }) {
    const built = useMemo(() => STORY_TEMPLATES.map((t) => ({ id: t.id, name: t.name, slide: t.build(palette) })), [palette]);
    return (
        <div>
            <Title>Modelli</Title>
            <p className="mb-3 text-xs text-slate-400">Sostituiscono il contenuto della slide aperta. Si adattano ai colori del cliente.</p>
            <div className="grid grid-cols-2 gap-3">
                {built.map((t) => (
                    <button key={t.id} type="button" onClick={() => onApply(t.slide)} className="group/card text-left">
                        <div className="overflow-hidden rounded-lg border border-slate-700 group-hover/card:border-sky-500">
                            <SlideStage slide={t.slide} scale={0.125} fontsVersion={fontsVersion} />
                        </div>
                        <span className="mt-1 block text-xs text-slate-300">{t.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export function TextPanel({ onAdd, palette }: { onAdd: (l: Layer) => void; palette: Palette }) {
    return (
        <div>
            <Title>Testo</Title>
            <div className="grid gap-2">
                <Btn onClick={() => onAdd(makeText({ text: 'Titolo', fontSize: 130, fontFamily: 'Montserrat' }))}><span className="text-lg font-extrabold">Aggiungi un titolo</span></Btn>
                <Btn onClick={() => onAdd(makeText({ text: 'Sottotitolo', fontSize: 70, fontFamily: 'Poppins', bold: false }))}><span className="font-medium">Aggiungi un sottotitolo</span></Btn>
                <Btn onClick={() => onAdd(makeText({ text: 'Testo del paragrafo', fontSize: 48, fontFamily: 'Inter', bold: false }))}><span className="text-sm">Aggiungi un testo</span></Btn>
                <Btn onClick={() => onAdd(makeText({ text: 'NOVITÀ', fontSize: 58, fontFamily: 'Oswald', letterSpacing: 8, background: palette.primary, fill: '#ffffff', width: 420 }))}><span className="font-bold tracking-widest">ETICHETTA CON SFONDO</span></Btn>
                <Btn onClick={() => onAdd(makeText({ text: 'Con contorno', fontSize: 140, fontFamily: 'Anton', bold: false, stroke: '#000000', strokeWidth: 10, shadow: true }))}><span className="font-bold">Testo con contorno</span></Btn>
                <Btn onClick={() => onAdd(makeText({ text: 'Scritto a mano', fontSize: 120, fontFamily: 'Pacifico', bold: false }))}><span style={{ fontFamily: 'Pacifico, cursive' }}>Scritto a mano</span></Btn>
            </div>
        </div>
    );
}

const STICKER_ICON: Record<StickerKind, string> = { link: '🔗', hashtag: '#', mention: '@', location: '📍', music: '🎵', poll: '📊', question: '❓', quiz: '✅', slider: '😍', countdown: '⏳' };

export function StickersPanel({ onAdd }: { onAdd: (l: Layer) => void }) {
    return (
        <div>
            <Title>Sticker</Title>
            <p className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
                Sono disegnati nella storia, ma <b>non sono cliccabili</b>: l&apos;API ufficiale di Instagram non pubblica sticker interattivi. Link, sondaggi e simili vanno aggiunti a mano dall&apos;app prima di pubblicare.
            </p>
            <div className="grid grid-cols-2 gap-2">
                {(Object.keys(STICKER_DEFAULTS) as StickerKind[]).map((k) => (
                    <Btn key={k} onClick={() => onAdd(makeSticker(k))}>
                        <span className="mr-2">{STICKER_ICON[k]}</span>{STICKER_DEFAULTS[k].label}
                    </Btn>
                ))}
            </div>
        </div>
    );
}

export function EmojiPanel({ onAdd }: { onAdd: (l: Layer) => void }) {
    return (
        <div>
            <Title>Emoji</Title>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                {EMOJI_GROUPS.map((g) => (
                    <div key={g.name}>
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.name}</div>
                        <div className="grid grid-cols-6 gap-1">
                            {g.items.map((e) => (
                                <button key={e} type="button" onClick={() => onAdd(makeEmoji(e))} className="rounded-md p-1 text-2xl hover:bg-slate-800">{e}</button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ShapesPanel({ onAdd, palette }: { onAdd: (l: Layer) => void; palette: Palette }) {
    return (
        <div>
            <Title>Forme</Title>
            <div className="grid grid-cols-3 gap-2">
                <Btn onClick={() => onAdd(makeShape('rect', { fill: palette.primary }))}><div className="mx-auto h-8 w-12 rounded-md" style={{ background: palette.primary }} /></Btn>
                <Btn onClick={() => onAdd(makeShape('circle', { fill: palette.secondary }))}><div className="mx-auto h-10 w-10 rounded-full" style={{ background: palette.secondary }} /></Btn>
                <Btn onClick={() => onAdd(makeShape('line'))}><div className="mx-auto mt-4 h-1 w-12 rounded bg-white" /></Btn>
            </div>
        </div>
    );
}

const GRADIENTS: [string, string][] = [['#833ab4', '#fcb045'], ['#ec4899', '#f59e0b'], ['#06b6d4', '#3b82f6'], ['#22c55e', '#0ea5e9'], ['#111827', '#6366f1'], ['#f43f5e', '#111827'], ['#ffffff', '#cbd5e1'], ['#0f172a', '#334155']];

export function BackgroundPanel({ background, onChange, onUploadFiles, palette }: {
    background: Background; onChange: (b: Background, key?: string) => void; onUploadFiles: (files: File[]) => Promise<UploadedMedia[]>; palette: Palette;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const color = background.type === 'color' ? background.color : '';
    return (
        <div className="space-y-4">
            <Title>Sfondo</Title>
            <ColorField label="Tinta unita" value={color} onChange={(c) => onChange({ type: 'color', color: c }, 'bg-color')} extra={[palette.primary, palette.secondary, palette.dark]} />
            <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Sfumature</div>
                <div className="grid grid-cols-4 gap-2">
                    {GRADIENTS.map(([from, to]) => (
                        <button key={from + to} type="button" aria-label={`Sfumatura ${from} ${to}`} onClick={() => onChange({ type: 'gradient', from, to, angle: 160 })}
                            className="h-12 rounded-md border border-slate-700 hover:border-sky-500" style={{ background: `linear-gradient(160deg, ${from}, ${to})` }} />
                    ))}
                </div>
            </div>
            {background.type === 'gradient' && (
                <div className="space-y-3">
                    <ColorField label="Colore iniziale" value={background.from} onChange={(c) => onChange({ ...background, from: c }, 'bg-grad')} />
                    <ColorField label="Colore finale" value={background.to} onChange={(c) => onChange({ ...background, to: c }, 'bg-grad')} />
                    <Range label="Angolo" value={background.angle} min={0} max={360} onChange={(v) => onChange({ ...background, angle: v }, 'bg-grad')} suffix="°" />
                </div>
            )}
            <div>
                <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 px-3 py-3 text-sm text-slate-200 hover:border-sky-500">
                    <Upload className="h-4 w-4" /> {busy ? 'Caricamento…' : 'Usa un\'immagine come sfondo'}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    e.target.value = '';
                    if (!files.length) return;
                    setBusy(true);
                    try { const [m] = await onUploadFiles(files); if (m) onChange({ type: 'image', url: m.url, fit: 'cover', blur: 0, dim: 0 }); } finally { setBusy(false); }
                }} />
            </div>
            {background.type === 'image' && (
                <div className="space-y-3">
                    <Field label="Adattamento">
                        <select className={inputCls} value={background.fit} onChange={(e) => onChange({ ...background, fit: e.target.value as 'cover' | 'contain' })}>
                            <option value="cover">Riempi la tela</option>
                            <option value="contain">Mostra intera</option>
                        </select>
                    </Field>
                    <Range label="Sfocatura" value={background.blur} min={0} max={60} onChange={(v) => onChange({ ...background, blur: v }, 'bg-blur')} />
                    <Range label="Scurisci" value={background.dim} min={0} max={0.9} step={0.05} onChange={(v) => onChange({ ...background, dim: v }, 'bg-dim')} />
                </div>
            )}
        </div>
    );
}

export function MediaPanel({ uploaded, onUploadFiles, onAddImage, onUseAsBackground, clientMedia, onAddClientImage, onClientImageAsBackground }: {
    uploaded: UploadedMedia[]; onUploadFiles: (files: File[]) => Promise<UploadedMedia[]>;
    onAddImage: (m: UploadedMedia) => void; onUseAsBackground: (m: UploadedMedia) => void;
    /** I media che il cliente ha già (null = non disponibile in questa schermata). */
    clientMedia?: { items: ClientMediaItem[]; loading: boolean; error: string } | null;
    onAddClientImage?: (m: ClientMediaItem) => void;
    onClientImageAsBackground?: (m: ClientMediaItem) => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    return (
        <div className="space-y-3">
            <Title>Media</Title>
            <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-600 px-3 py-4 text-sm text-slate-200 hover:border-sky-500">
                <Upload className="h-4 w-4" /> {busy ? 'Caricamento…' : 'Carica immagini'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                e.target.value = '';
                if (!files.length) return;
                setBusy(true);
                try { await onUploadFiles(files); } finally { setBusy(false); }
            }} />
            {uploaded.length === 0 && <p className="text-xs text-slate-400">Le immagini che carichi compaiono qui, pronte da aggiungere o da usare come sfondo.</p>}
            <div className="grid grid-cols-2 gap-2">
                {uploaded.map((m) => (
                    <div key={m.url} className="overflow-hidden rounded-lg border border-slate-700">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={m.url} alt={m.filename} className="h-28 w-full object-cover" />
                        <div className="flex gap-1 p-1">
                            <button type="button" onClick={() => onAddImage(m)} className="flex-1 rounded bg-slate-800 px-1 py-1 text-[11px] text-slate-100 hover:bg-slate-700">Aggiungi</button>
                            <button type="button" onClick={() => onUseAsBackground(m)} className="flex-1 rounded bg-slate-800 px-1 py-1 text-[11px] text-slate-100 hover:bg-slate-700">Sfondo</button>
                        </div>
                    </div>
                ))}
            </div>
            {clientMedia && (
                <div className="space-y-2 border-t border-slate-800 pt-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Del cliente</div>
                    {clientMedia.loading && <p className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Carico…</p>}
                    {clientMedia.error && <p className="text-xs text-red-300">{clientMedia.error}</p>}
                    {!clientMedia.loading && !clientMedia.error && clientMedia.items.filter((i) => i.kind === 'image').length === 0 && <p className="text-xs text-slate-400">Nessuna immagine ancora: compaiono qui i file della galleria e quelli dei contenuti del PED.</p>}
                    <div className="grid grid-cols-3 gap-1.5">
                        {clientMedia.items.filter((i) => i.kind === 'image').map((m) => (
                            <div key={m.url} className="group/card relative overflow-hidden rounded-md border border-slate-700">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={viaProxy(m.url)} alt={m.name} loading="lazy" className="h-20 w-full object-cover" />
                                <div className="absolute inset-0 flex flex-col justify-end gap-0.5 bg-black/55 p-0.5 opacity-0 transition-opacity group-hover/card:opacity-100">
                                    <button type="button" onClick={() => onAddClientImage?.(m)} className="rounded bg-slate-900/90 py-0.5 text-[10px] text-white hover:bg-sky-600">Aggiungi</button>
                                    <button type="button" onClick={() => onClientImageAsBackground?.(m)} className="rounded bg-slate-900/90 py-0.5 text-[10px] text-white hover:bg-sky-600">Sfondo</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

interface StockState { items: StockItem[]; cursor: number | null; status: 'loading' | 'ready' | 'error' | 'unconfigured'; error: string }

/** GIF (Giphy) o foto d'archivio (Pexels): ricerca, risultati, «carica altri». Le chiavi stanno sul server. */
export function StockPanel({ kind, onAdd, onBackground }: { kind: 'gif' | 'photo'; onAdd: (i: StockItem) => void; onBackground?: (i: StockItem) => void }) {
    const gif = kind === 'gif';
    const [input, setInput] = useState('');
    const [query, setQuery] = useState('');
    const [st, setSt] = useState<StockState>({ items: [], cursor: null, status: 'loading', error: '' });

    const load = useCallback(async (q: string, cursor: number, append: boolean) => {
        setSt((p) => ({ ...p, status: 'loading', error: '', items: append ? p.items : [] }));
        try {
            const res = await fetch(`${gif ? '/api/stories/giphy' : '/api/stories/pexels'}?q=${encodeURIComponent(q)}&${gif ? 'offset' : 'page'}=${cursor}`);
            const d = await res.json().catch(() => ({}));
            if (d.configured === false) { setSt({ items: [], cursor: null, status: 'unconfigured', error: '' }); return; }
            if (!res.ok) throw new Error(d.error || 'Servizio non disponibile.');
            setSt((p) => ({ items: append ? [...p.items, ...d.items] : d.items, cursor: (gif ? d.nextOffset : d.nextPage) ?? null, status: 'ready', error: '' }));
        } catch (e: any) {
            setSt((p) => ({ ...p, status: 'error', error: e?.message || 'Servizio non disponibile.' }));
        }
    }, [gif]);

    useEffect(() => { setInput(''); setQuery(''); load('', gif ? 0 : 1, false); }, [gif, load]);

    return (
        <div className="space-y-3">
            <Title>{gif ? 'GIF' : 'Foto d\'archivio'}</Title>
            <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); setQuery(input.trim()); load(input.trim(), gif ? 0 : 1, false); }}>
                <input className={inputCls} value={input} onChange={(e) => setInput(e.target.value)} placeholder={gif ? 'Cerca una GIF…' : 'Cerca una foto…'} aria-label="Cerca" />
                <button type="submit" className="rounded-md border border-slate-700 bg-slate-900 px-2 hover:bg-slate-800" aria-label="Cerca"><Search className="h-4 w-4" /></button>
            </form>
            {gif && <p className="text-[11px] text-slate-400">Nella storia le GIF restano ferme (è un&apos;immagine): si animano solo nel video.</p>}
            {st.status === 'unconfigured' && (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-200">
                    Servizio non ancora attivo: manca la chiave <b>{gif ? 'GIPHY_API_KEY' : 'PEXELS_API_KEY'}</b> tra le variabili di Vercel.
                </p>
            )}
            {st.status === 'error' && <p className="text-xs text-red-300">{st.error}</p>}
            {st.status === 'ready' && st.items.length === 0 && <p className="text-xs text-slate-400">Nessun risultato{query ? ` per «${query}»` : ''}.</p>}
            <div className="grid grid-cols-2 gap-2">
                {st.items.map((i) => (
                    <div key={i.id} className="group/card relative overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={viaProxy(i.preview)} alt={i.title} loading="lazy" className={gif ? 'h-24 w-full object-cover' : 'h-40 w-full object-cover'} />
                        <div className="absolute inset-0 flex flex-col justify-end gap-1 bg-black/50 p-1 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100">
                            <button type="button" onClick={() => onAdd(i)} className="rounded bg-slate-900/90 py-1 text-[11px] text-white hover:bg-sky-600">Aggiungi</button>
                            {!gif && onBackground && <button type="button" onClick={() => onBackground(i)} className="rounded bg-slate-900/90 py-1 text-[11px] text-white hover:bg-sky-600">Usa come sfondo</button>}
                        </div>
                        {i.credit && <div className="truncate px-1 py-0.5 text-[10px] text-slate-400" title={`Foto di ${i.credit} su Pexels`}>{i.credit}</div>}
                    </div>
                ))}
            </div>
            {st.status === 'loading' && <p className="flex items-center gap-2 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Carico…</p>}
            {st.status === 'ready' && st.cursor !== null && (
                <button type="button" onClick={() => load(query, st.cursor as number, true)} className="w-full rounded-md border border-slate-700 bg-slate-900 py-2 text-sm hover:bg-slate-800">Carica altri</button>
            )}
            <p className="text-[10px] text-slate-500">{gif ? 'Powered by GIPHY' : 'Foto fornite da Pexels'}</p>
        </div>
    );
}
