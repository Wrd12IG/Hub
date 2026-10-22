/**
 * lib/story-editor/types.ts
 *
 * Il modello dell'editor delle storie: un progetto è un elenco di slide, ogni slide ha uno sfondo e dei livelli.
 * Le coordinate sono in pixel della storia finale (1080×1920): la tela a schermo è solo una versione ridotta.
 */

export const STORY_W = 1080;
export const STORY_H = 1920;
/** Fascia in alto e in basso coperta dall'interfaccia di Instagram (nome, barra «Invia messaggio»): niente di importante lì. */
export const SAFE_TOP = 250;
export const SAFE_BOTTOM = 340;

export type StickerKind = 'link' | 'hashtag' | 'mention' | 'location' | 'music' | 'poll' | 'question' | 'quiz' | 'slider' | 'countdown';

interface LayerBase {
    id: string;
    name?: string;
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    opacity: number;
    locked?: boolean;
    hidden?: boolean;
}

export interface TextLayer extends LayerBase {
    type: 'text';
    text: string;
    fontFamily: string;
    fontSize: number;
    bold: boolean;
    italic: boolean;
    fill: string;
    align: 'left' | 'center' | 'right';
    /** Larghezza della casella di testo (il testo va a capo dentro). */
    width: number;
    lineHeight: number;
    letterSpacing: number;
    uppercase: boolean;
    /** Sfondo «a pillola» dietro il testo; vuoto = nessuno. */
    background: string;
    stroke: string;
    strokeWidth: number;
    shadow: boolean;
}

export interface EmojiLayer extends LayerBase {
    type: 'emoji';
    text: string;
    fontSize: number;
}

export interface ImageLayer extends LayerBase {
    type: 'image';
    url: string;
    width: number;
    height: number;
    cornerRadius: number;
    /** Da dove arriva: serve a sapere come trattarla (una GIF resta ferma nell'immagine, si anima solo nel video). */
    source?: 'upload' | 'gif' | 'stock';
}

export interface ShapeLayer extends LayerBase {
    type: 'shape';
    shape: 'rect' | 'circle' | 'line';
    width: number;
    height: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    cornerRadius: number;
}

/** Sticker «disegnati»: hanno l'aspetto di quelli di Instagram ma non sono cliccabili (l'API ufficiale non li pubblica). */
export interface StickerLayer extends LayerBase {
    type: 'sticker';
    sticker: StickerKind;
    /** Testo principale: indirizzo, #hashtag, @menzione, luogo, domanda… */
    text: string;
    /** Opzioni (sondaggio, quiz). */
    options: string[];
}

export type Layer = TextLayer | EmojiLayer | ImageLayer | ShapeLayer | StickerLayer;
export type LayerType = Layer['type'];

export type Background =
    | { type: 'color'; color: string }
    | { type: 'gradient'; from: string; to: string; angle: number }
    | { type: 'image'; url: string; fit: 'cover' | 'contain'; blur: number; dim: number }
    | { type: 'video'; url: string; trimStart: number; trimEnd: number };

export interface Slide {
    id: string;
    name: string;
    background: Background;
    layers: Layer[];
}

export interface StoryDesign {
    version: 2;
    slides: Slide[];
}

export interface Rect { x: number; y: number; width: number; height: number }
