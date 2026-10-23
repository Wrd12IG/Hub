'use client';

/**
 * components/story-editor/SlideStage.tsx
 *
 * Disegna UNA slide su una tela Konva. È usato due volte: nell'editor (interattivo, ridotto a schermo) e per
 * l'esportazione (non interattivo, a 1080×1920 reali). Le coordinate dei livelli sono sempre quelle della storia finale;
 * a schermo la tela è soltanto scalata.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Stage, Layer as KLayer, Group, Rect, Circle, Line, Text, Image as KImage, Transformer } from 'react-konva';
import { STORY_H, STORY_W, type Background, type Layer, type Slide, type TextLayer } from '@/lib/story-editor/types';
import { computeSnap } from '@/lib/story-editor/snap';
import { cachedImage, loadImage } from './image-cache';
import { StickerShape, stickerSize } from './stickers';
import { cachedPoster, loadPoster } from './video-poster';

export interface SlideStageHandle { toJpeg: (quality?: number) => string }

interface Props {
    slide: Slide;
    scale: number;
    interactive?: boolean;
    selectedId?: string | null;
    onSelect?: (id: string | null) => void;
    onChange?: (layerId: string, patch: Partial<Layer>, key?: string) => void;
    /** Guide magnetiche attive durante il trascinamento. */
    snap?: boolean;
    /** Cambia quando i caratteri finiscono di caricarsi: la tela va ridisegnata. */
    fontsVersion?: number;
    stageRef?: React.MutableRefObject<Konva.Stage | null>;
}

/** Immagine con caricamento: usa la cache se c'è, altrimenti la scarica e ridisegna. */
function useStoryImage(url: string): HTMLImageElement | null {
    const [img, setImg] = useState<HTMLImageElement | null>(() => cachedImage(url));
    useEffect(() => {
        let alive = true;
        const hit = cachedImage(url);
        if (hit) { setImg(hit); return; }
        loadImage(url).then((i) => { if (alive) setImg(i); });
        return () => { alive = false; };
    }, [url]);
    return img;
}

/** Primo fotogramma del video di sfondo (null finché non è pronto o se il browser non lo legge). */
function useVideoPoster(url: string, t: number): HTMLCanvasElement | null {
    const [poster, setPoster] = useState<HTMLCanvasElement | null>(() => (url ? cachedPoster(url, t) : null));
    useEffect(() => {
        let alive = true;
        if (!url) { setPoster(null); return; }
        const hit = cachedPoster(url, t);
        if (hit) { setPoster(hit); return; }
        loadPoster(url, t).then((c) => { if (alive) setPoster(c); });
        return () => { alive = false; };
    }, [url, t]);
    return poster;
}

function gradientPoints(angle: number) {
    // angolo CSS-like: 0 = dal basso verso l'alto, 90 = da sinistra a destra
    const rad = ((angle - 90) * Math.PI) / 180;
    const cx = STORY_W / 2, cy = STORY_H / 2;
    const len = Math.abs(STORY_W * Math.cos(rad)) + Math.abs(STORY_H * Math.sin(rad));
    return { start: { x: cx - (Math.cos(rad) * len) / 2, y: cy - (Math.sin(rad) * len) / 2 }, end: { x: cx + (Math.cos(rad) * len) / 2, y: cy + (Math.sin(rad) * len) / 2 } };
}

function BackgroundShape({ bg }: { bg: Background }) {
    const url = bg.type === 'image' ? bg.url : '';
    const img = useStoryImage(url);
    const imgRef = useRef<Konva.Image>(null);
    const blur = bg.type === 'image' ? bg.blur : 0;
    const poster = useVideoPoster(bg.type === 'video' ? bg.url : '', bg.type === 'video' ? bg.trimStart : 0);

    useEffect(() => {
        const node = imgRef.current;
        if (!node) return;
        if (blur > 0) { node.cache(); node.filters([Konva.Filters.Blur]); node.blurRadius(blur); } else { node.filters([]); node.clearCache(); }
        node.getLayer()?.batchDraw();
    }, [blur, img]);

    if (bg.type === 'color') return <Rect width={STORY_W} height={STORY_H} fill={bg.color} listening={false} />;
    if (bg.type === 'gradient') {
        const { start, end } = gradientPoints(bg.angle);
        return <Rect width={STORY_W} height={STORY_H} fillLinearGradientStartPoint={start} fillLinearGradientEndPoint={end} fillLinearGradientColorStops={[0, bg.from, 1, bg.to]} listening={false} />;
    }
    if (bg.type === 'image') {
        let props: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: STORY_W, height: STORY_H };
        if (img) {
            const k = bg.fit === 'cover' ? Math.max(STORY_W / img.width, STORY_H / img.height) : Math.min(STORY_W / img.width, STORY_H / img.height);
            const w = img.width * k, h = img.height * k;
            props = { x: (STORY_W - w) / 2, y: (STORY_H - h) / 2, width: w, height: h };
        }
        return (
            <>
                <Rect width={STORY_W} height={STORY_H} fill="#000" listening={false} />
                {img && <KImage ref={imgRef} image={img} {...props} listening={false} />}
                {bg.dim > 0 && <Rect width={STORY_W} height={STORY_H} fill="#000" opacity={bg.dim} listening={false} />}
            </>
        );
    }
    // video: nell'editor e nel JPEG di riserva si vede il primo fotogramma; il movimento sta nell'MP4 esportato
    let vp = { x: 0, y: 0, width: STORY_W, height: STORY_H };
    if (poster) {
        const k = Math.max(STORY_W / poster.width, STORY_H / poster.height);
        const w = poster.width * k, h = poster.height * k;
        vp = { x: (STORY_W - w) / 2, y: (STORY_H - h) / 2, width: w, height: h };
    }
    return (
        <>
            <Rect width={STORY_W} height={STORY_H} fill="#000" listening={false} />
            {poster && <KImage image={poster} {...vp} listening={false} />}
        </>
    );
}

const fontStyle = (l: { bold: boolean; italic: boolean }) => `${l.italic ? 'italic ' : ''}${l.bold ? 'bold' : 'normal'}`.trim();

function TextShape({ l, fontsVersion }: { l: TextLayer; fontsVersion: number }) {
    const content = l.uppercase ? l.text.toUpperCase() : l.text;
    const common = {
        text: content, fontFamily: l.fontFamily, fontSize: l.fontSize, fontStyle: fontStyle(l), fill: l.fill, align: l.align, width: l.width,
        lineHeight: l.lineHeight, letterSpacing: l.letterSpacing, stroke: l.strokeWidth > 0 ? l.stroke : undefined, strokeWidth: l.strokeWidth,
        fillAfterStrokeEnabled: true,
    };
    const height = useMemo(() => new Konva.Text(common).height(), [content, l.fontFamily, l.fontSize, l.bold, l.italic, l.width, l.lineHeight, l.letterSpacing, l.strokeWidth, fontsVersion]); // eslint-disable-line react-hooks/exhaustive-deps
    const pad = 28;
    return (
        <>
            {l.background && <Rect x={-pad} y={-pad / 2} width={l.width + pad * 2} height={height + pad} cornerRadius={(height + pad) / 3} fill={l.background} />}
            <Text {...common} shadowColor={l.shadow ? 'rgba(0,0,0,0.55)' : undefined} shadowBlur={l.shadow ? 18 : 0} shadowOffsetY={l.shadow ? 6 : 0} shadowOpacity={l.shadow ? 1 : 0} />
        </>
    );
}

function ImageShape({ url, width, height, cornerRadius }: { url: string; width: number; height: number; cornerRadius: number }) {
    const img = useStoryImage(url);
    if (!img) return <Rect width={width} height={height} fill="#374151" cornerRadius={cornerRadius} />;
    return <KImage image={img} width={width} height={height} cornerRadius={cornerRadius} />;
}

function LayerBody({ layer, fontsVersion }: { layer: Layer; fontsVersion: number }) {
    switch (layer.type) {
        case 'text': return <TextShape l={layer} fontsVersion={fontsVersion} />;
        case 'emoji': return <Text text={layer.text} fontSize={layer.fontSize} />;
        case 'image': return <ImageShape url={layer.url} width={layer.width} height={layer.height} cornerRadius={layer.cornerRadius} />;
        case 'sticker': return <StickerShape layer={layer} />;
        case 'shape':
            if (layer.shape === 'circle') return <Circle x={layer.width / 2} y={layer.height / 2} radius={layer.width / 2} fill={layer.fill || undefined} stroke={layer.strokeWidth ? layer.stroke : undefined} strokeWidth={layer.strokeWidth} />;
            if (layer.shape === 'line') return <Line points={[0, 0, layer.width, 0]} stroke={layer.stroke || '#fff'} strokeWidth={layer.strokeWidth || 8} lineCap="round" hitStrokeWidth={Math.max(40, layer.strokeWidth)} />;
            return <Rect width={layer.width} height={layer.height} cornerRadius={layer.cornerRadius} fill={layer.fill || undefined} stroke={layer.strokeWidth ? layer.stroke : undefined} strokeWidth={layer.strokeWidth} />;
    }
}

export function SlideStage({ slide, scale, interactive = false, selectedId = null, onSelect, onChange, snap = true, fontsVersion = 0, stageRef }: Props) {
    const localStage = useRef<Konva.Stage | null>(null);
    const trRef = useRef<Konva.Transformer>(null);
    const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });
    const dragKey = useRef<string>('');

    const setStage = (node: Konva.Stage | null) => { localStage.current = node; if (stageRef) stageRef.current = node; };

    // Il selettore di trasformazione segue il livello scelto
    useEffect(() => {
        const stage = localStage.current, tr = trRef.current;
        if (!stage || !tr) return;
        const node = selectedId ? stage.findOne(`#${selectedId}`) : null;
        tr.nodes(node ? [node] : []);
        tr.getLayer()?.batchDraw();
    }, [selectedId, slide, interactive]);

    // Ridisegna quando i caratteri sono pronti (la misura del testo cambia)
    useEffect(() => {
        const stage = localStage.current;
        if (!stage) return;
        // Konva calcola righe e larghezze del testo quando cambia il carattere, non quando il carattere finisce di
        // scaricarsi: senza questo giro il testo resta impaginato con le misure del carattere di ripiego.
        stage.find('Text').forEach((node) => {
            const t = node as Konva.Text;
            const family = t.fontFamily();
            t.fontFamily(`${family} `);
            t.fontFamily(family);
        });
        stage.batchDraw();
    }, [fontsVersion]);

    const selected = slide.layers.find((l) => l.id === selectedId);

    const onDragMove = (e: Konva.KonvaEventObject<DragEvent>, id: string) => {
        const node = e.target;
        const layer = node.getLayer();
        const stage = localStage.current;
        if (!layer || !stage) return;
        const box = node.getClientRect({ relativeTo: layer });
        const others = slide.layers.filter((l) => l.id !== id && !l.hidden).map((l) => stage.findOne(`#${l.id}`)).filter(Boolean).map((n) => (n as Konva.Node).getClientRect({ relativeTo: layer }));
        if (!snap) { setGuides({ v: [], h: [] }); return; }
        const res = computeSnap({ x: box.x, y: box.y, width: box.width, height: box.height }, others, 14 / Math.max(scale, 0.2));
        if (res.dx) node.x(node.x() + res.dx);
        if (res.dy) node.y(node.y() + res.dy);
        setGuides({ v: res.vertical, h: res.horizontal });
    };

    const commitNode = (node: Konva.Node, layer: Layer, key: string) => {
        let patch: Partial<Layer> = { x: node.x(), y: node.y(), rotation: node.rotation() };
        const sx = node.scaleX(), sy = node.scaleY();
        if (layer.type === 'text') {
            const uniform = Math.abs(sx - sy) < 0.02;
            patch = { ...patch, width: Math.max(80, layer.width * sx), fontSize: uniform ? Math.max(8, layer.fontSize * sx) : layer.fontSize, scaleX: 1, scaleY: 1 } as Partial<Layer>;
            node.scaleX(1); node.scaleY(1);
        } else if (layer.type === 'emoji') {
            patch = { ...patch, fontSize: Math.max(16, layer.fontSize * sx), scaleX: 1, scaleY: 1 } as Partial<Layer>;
            node.scaleX(1); node.scaleY(1);
        } else if (layer.type === 'image' || layer.type === 'shape') {
            patch = { ...patch, width: Math.max(10, layer.width * sx), height: layer.type === 'shape' && layer.shape === 'line' ? 0 : Math.max(10, layer.height * sy), scaleX: 1, scaleY: 1 } as Partial<Layer>;
            node.scaleX(1); node.scaleY(1);
        } else {
            patch = { ...patch, scaleX: sx, scaleY: sy };
        }
        onChange?.(layer.id, patch, key);
    };

    return (
        <Stage
            ref={setStage}
            width={STORY_W * scale}
            height={STORY_H * scale}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={interactive ? (e) => { if (e.target === e.target.getStage()) onSelect?.(null); } : undefined}
            onTouchStart={interactive ? (e) => { if (e.target === e.target.getStage()) onSelect?.(null); } : undefined}
        >
            <KLayer listening={interactive}>
                <Group listening={interactive} onMouseDown={interactive ? () => onSelect?.(null) : undefined}>
                    <BackgroundShape bg={slide.background} />
                </Group>
                {slide.layers.map((layer) => {
                    const sz = layer.type === 'sticker' ? stickerSize(layer) : null;
                    return (
                        <Group
                            key={layer.id}
                            id={layer.id}
                            x={layer.x}
                            y={layer.y}
                            rotation={layer.rotation}
                            scaleX={layer.scaleX}
                            scaleY={layer.scaleY}
                            opacity={layer.opacity}
                            visible={!layer.hidden}
                            draggable={interactive && !layer.locked}
                            listening={interactive && !layer.locked}
                            width={sz?.width}
                            height={sz?.height}
                            onMouseDown={interactive ? (e) => { e.cancelBubble = true; onSelect?.(layer.id); } : undefined}
                            onTouchStart={interactive ? (e) => { e.cancelBubble = true; onSelect?.(layer.id); } : undefined}
                            onDragStart={() => { dragKey.current = `drag:${layer.id}:${Date.now()}`; }}
                            onDragMove={(e) => onDragMove(e, layer.id)}
                            onDragEnd={(e) => { setGuides({ v: [], h: [] }); commitNode(e.target, layer, dragKey.current || `drag:${layer.id}:${Date.now()}`); }}
                            onTransformEnd={(e) => commitNode(e.target, layer, `tr:${layer.id}:${Date.now()}`)}
                        >
                            <LayerBody layer={layer} fontsVersion={fontsVersion} />
                        </Group>
                    );
                })}
            </KLayer>
            {interactive && (
                <KLayer>
                    {guides.v.map((x) => <Line key={`v${x}`} points={[x, 0, x, STORY_H]} stroke="#f43f5e" strokeWidth={2 / scale} dash={[10 / scale, 8 / scale]} listening={false} />)}
                    {guides.h.map((y) => <Line key={`h${y}`} points={[0, y, STORY_W, y]} stroke="#f43f5e" strokeWidth={2 / scale} dash={[10 / scale, 8 / scale]} listening={false} />)}
                    <Transformer
                        ref={trRef}
                        rotateEnabled
                        keepRatio={selected ? selected.type === 'sticker' || selected.type === 'emoji' : false}
                        enabledAnchors={selected?.type === 'text' ? ['middle-left', 'middle-right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'] : undefined}
                        anchorSize={14}
                        anchorCornerRadius={7}
                        borderStroke="#38bdf8"
                        anchorStroke="#38bdf8"
                        anchorFill="#fff"
                        boundBoxFunc={(oldBox, newBox) => (newBox.width < 40 || newBox.height < 20 ? oldBox : newBox)}
                    />
                </KLayer>
            )}
        </Stage>
    );
}
