'use client';

/**
 * components/story-editor/properties.tsx
 *
 * Il pannello a destra: proprietà del livello scelto (o della slide), ordine dei livelli.
 */
import React from 'react';
import { ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpToLine, Copy, Eye, EyeOff, Lock, Trash2, Unlock } from 'lucide-react';
import { STORY_FONTS } from '@/lib/story-editor/fonts';
import type { Layer, Slide, TextLayer } from '@/lib/story-editor/types';
import { ColorField, Field, Range, Toggle, inputCls } from './ui';

const LABEL: Record<Layer['type'], string> = { text: 'Testo', emoji: 'Emoji', image: 'Immagine', shape: 'Forma', sticker: 'Sticker' };

function layerName(l: Layer): string {
    if (l.type === 'text' || l.type === 'emoji') return l.text.replace(/\s+/g, ' ').slice(0, 22) || LABEL[l.type];
    if (l.type === 'sticker') return `${LABEL.sticker}: ${l.text.slice(0, 16)}`;
    if (l.type === 'shape') return l.shape === 'circle' ? 'Cerchio' : l.shape === 'line' ? 'Linea' : 'Rettangolo';
    return LABEL[l.type];
}

interface Props {
    slide: Slide;
    layer: Layer | null;
    onSelect: (id: string | null) => void;
    onUpdate: (id: string, patch: Partial<Layer>, key?: string) => void;
    onDuplicate: (id: string) => void;
    onDelete: (id: string) => void;
    onMove: (id: string, d: 'up' | 'down' | 'top' | 'bottom') => void;
    /** Toglie lo sfondo a un'immagine (Magnific, consuma crediti). Se manca, il pulsante non c'è. */
    onRemoveBackground?: (layer: Layer) => void;
}

function TextControls({ l, set }: { l: TextLayer; set: (p: Partial<TextLayer>, key?: string) => void }) {
    return (
        <div className="space-y-3">
            <Field label="Testo"><textarea className={inputCls} rows={3} value={l.text} onChange={(e) => set({ text: e.target.value }, `text:${l.id}`)} /></Field>
            <Field label="Carattere">
                <select className={inputCls} value={l.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })} style={{ fontFamily: l.fontFamily }}>
                    {STORY_FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
                </select>
            </Field>
            <Range label="Dimensione" value={Math.round(l.fontSize)} min={20} max={320} onChange={(v) => set({ fontSize: v }, `size:${l.id}`)} suffix=" px" />
            <div className="flex gap-1.5">
                <Toggle pressed={l.bold} onClick={() => set({ bold: !l.bold })} title="Grassetto"><b>G</b></Toggle>
                <Toggle pressed={l.italic} onClick={() => set({ italic: !l.italic })} title="Corsivo"><i>C</i></Toggle>
                <Toggle pressed={l.uppercase} onClick={() => set({ uppercase: !l.uppercase })} title="Maiuscolo">Aa</Toggle>
                <Toggle pressed={l.shadow} onClick={() => set({ shadow: !l.shadow })} title="Ombra">Ombra</Toggle>
            </div>
            <div className="flex gap-1.5">
                {(['left', 'center', 'right'] as const).map((a) => <Toggle key={a} pressed={l.align === a} onClick={() => set({ align: a })}>{a === 'left' ? 'Sinistra' : a === 'center' ? 'Centro' : 'Destra'}</Toggle>)}
            </div>
            <ColorField label="Colore" value={l.fill} onChange={(c) => set({ fill: c }, `fill:${l.id}`)} />
            <ColorField label="Sfondo a pillola" value={l.background} allowClear onChange={(c) => set({ background: c }, `bg:${l.id}`)} />
            <ColorField label="Contorno" value={l.stroke} allowClear onChange={(c) => set({ stroke: c, strokeWidth: c ? Math.max(l.strokeWidth, 6) : 0 }, `stroke:${l.id}`)} />
            {l.stroke && <Range label="Spessore contorno" value={l.strokeWidth} min={1} max={30} onChange={(v) => set({ strokeWidth: v }, `sw:${l.id}`)} />}
            <Range label="Spaziatura lettere" value={l.letterSpacing} min={-5} max={40} onChange={(v) => set({ letterSpacing: v }, `ls:${l.id}`)} />
            <Range label="Interlinea" value={l.lineHeight} min={0.8} max={2} step={0.05} onChange={(v) => set({ lineHeight: v }, `lh:${l.id}`)} />
        </div>
    );
}

export function PropertiesPanel({ slide, layer, onSelect, onUpdate, onDuplicate, onDelete, onMove, onRemoveBackground }: Props) {
    const set = (patch: Partial<Layer>, key?: string) => layer && onUpdate(layer.id, patch, key);
    const reversed = [...slide.layers].reverse();

    return (
        <div className="space-y-5 text-slate-200">
            {layer ? (
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold">{LABEL[layer.type]}</h3>
                        <div className="flex gap-1">
                            <IconBtn title="Duplica" onClick={() => onDuplicate(layer.id)}><Copy className="h-4 w-4" /></IconBtn>
                            <IconBtn title="Elimina" onClick={() => onDelete(layer.id)} danger><Trash2 className="h-4 w-4" /></IconBtn>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <IconBtn title="In primo piano" onClick={() => onMove(layer.id, 'top')}><ArrowUpToLine className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Avanti" onClick={() => onMove(layer.id, 'up')}><ArrowUp className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Indietro" onClick={() => onMove(layer.id, 'down')}><ArrowDown className="h-4 w-4" /></IconBtn>
                        <IconBtn title="In fondo" onClick={() => onMove(layer.id, 'bottom')}><ArrowDownToLine className="h-4 w-4" /></IconBtn>
                    </div>

                    {layer.type === 'text' && <TextControls l={layer} set={set as (p: Partial<TextLayer>, key?: string) => void} />}
                    {layer.type === 'emoji' && (
                        <div className="space-y-3">
                            <Field label="Emoji"><input className={inputCls} value={layer.text} onChange={(e) => set({ text: e.target.value }, `emoji:${layer.id}`)} /></Field>
                            <Range label="Dimensione" value={Math.round(layer.fontSize)} min={40} max={600} onChange={(v) => set({ fontSize: v }, `size:${layer.id}`)} suffix=" px" />
                        </div>
                    )}
                    {layer.type === 'sticker' && (
                        <div className="space-y-3">
                            <Field label={layer.sticker === 'link' ? 'Indirizzo o testo' : layer.sticker === 'hashtag' ? 'Hashtag (senza #)' : layer.sticker === 'mention' ? 'Account (senza @)' : 'Testo'}>
                                <input className={inputCls} value={layer.text} onChange={(e) => set({ text: e.target.value }, `stk:${layer.id}`)} />
                            </Field>
                            {layer.sticker === 'countdown' && (
                                <Field label="Data e ora di fine">
                                    <input type="datetime-local" className={inputCls} value={layer.endAt || ''} onChange={(e) => set({ endAt: e.target.value } as Partial<Layer>, `end:${layer.id}`)} />
                                </Field>
                            )}
                            {(layer.sticker === 'poll' || layer.sticker === 'quiz') && layer.options.map((o, i) => (
                                <Field key={i} label={`Opzione ${i + 1}`}>
                                    <input className={inputCls} value={o} onChange={(e) => set({ options: layer.options.map((x, j) => (j === i ? e.target.value : x)) } as Partial<Layer>, `opt:${layer.id}:${i}`)} />
                                </Field>
                            ))}
                            <p className="text-[11px] text-amber-300">{layer.sticker === 'countdown' ? 'La storia è un\'immagine ferma: qui si scrive la data. Il conto alla rovescia che scorre si aggiunge dall\'app di Instagram, con la stessa data.' : 'Disegnato nella storia, non cliccabile: aggiungi lo sticker vero dall\'app prima di pubblicare.'}</p>
                        </div>
                    )}
                    {layer.type === 'image' && (
                        <div className="space-y-3">
                            <Range label="Angoli arrotondati" value={layer.cornerRadius} min={0} max={300} onChange={(v) => set({ cornerRadius: v }, `cr:${layer.id}`)} />
                            {onRemoveBackground && (
                                <div>
                                    <button type="button" onClick={() => onRemoveBackground(layer)} disabled={!/^https:\/\//i.test(layer.url)}
                                        className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-2 text-sm hover:border-sky-500 disabled:opacity-40">Rimuovi sfondo (AI)</button>
                                    <p className="mt-1 text-[11px] text-slate-400">Consuma crediti Magnific. Serve un&apos;immagine già caricata.</p>
                                </div>
                            )}
                        </div>
                    )}
                    {layer.type === 'shape' && (
                        <div className="space-y-3">
                            {layer.shape !== 'line' && <ColorField label="Riempimento" value={layer.fill} allowClear onChange={(c) => set({ fill: c }, `fill:${layer.id}`)} />}
                            <ColorField label={layer.shape === 'line' ? 'Colore' : 'Bordo'} value={layer.stroke} allowClear onChange={(c) => set({ stroke: c, strokeWidth: c ? Math.max(layer.strokeWidth, 8) : 0 }, `stroke:${layer.id}`)} />
                            {layer.stroke && <Range label="Spessore" value={layer.strokeWidth} min={1} max={60} onChange={(v) => set({ strokeWidth: v }, `sw:${layer.id}`)} />}
                            {layer.shape === 'rect' && <Range label="Angoli arrotondati" value={layer.cornerRadius} min={0} max={300} onChange={(v) => set({ cornerRadius: v }, `cr:${layer.id}`)} />}
                        </div>
                    )}
                    <Range label="Opacità" value={layer.opacity} min={0.05} max={1} step={0.05} onChange={(v) => set({ opacity: v }, `op:${layer.id}`)} />
                    <Range label="Rotazione" value={Math.round(layer.rotation)} min={-180} max={180} onChange={(v) => set({ rotation: v }, `rot:${layer.id}`)} suffix="°" />
                </section>
            ) : (
                <p className="text-sm text-slate-400">Seleziona un elemento sulla tela per modificarlo, oppure aggiungine uno dalla barra a sinistra. Trascina per spostare, usa le maniglie per ridimensionare e ruotare.</p>
            )}

            <section>
                <h3 className="mb-2 text-sm font-bold">Livelli</h3>
                {reversed.length === 0 && <p className="text-xs text-slate-400">Nessun elemento in questa slide.</p>}
                <ul className="space-y-1">
                    {reversed.map((l) => (
                        <li key={l.id}>
                            <div className={`flex items-center gap-1 rounded-md border px-2 py-1 text-sm ${layer?.id === l.id ? 'border-sky-500 bg-sky-500/10' : 'border-slate-700 bg-slate-900'}`}>
                                <button type="button" className="flex-1 truncate text-left" onClick={() => onSelect(l.id)}>{layerName(l)}</button>
                                <IconBtn title={l.hidden ? 'Mostra' : 'Nascondi'} onClick={() => onUpdate(l.id, { hidden: !l.hidden })} small>{l.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</IconBtn>
                                <IconBtn title={l.locked ? 'Sblocca' : 'Blocca'} onClick={() => onUpdate(l.id, { locked: !l.locked })} small>{l.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}</IconBtn>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}

function IconBtn({ children, onClick, title, danger, small }: { children: React.ReactNode; onClick: () => void; title: string; danger?: boolean; small?: boolean }) {
    return (
        <button type="button" title={title} aria-label={title} onClick={onClick}
            className={`flex items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 ${small ? 'h-6 w-6' : 'h-8 w-8'} ${danger ? 'hover:border-red-500 hover:text-red-300' : ''}`}>
            {children}
        </button>
    );
}
