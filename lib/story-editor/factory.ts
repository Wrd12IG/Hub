/**
 * lib/story-editor/factory.ts
 *
 * Costruttori dei livelli e delle slide con i valori di partenza. Pure, tranne `uid` (che genera gli id).
 */
import { STORY_H, STORY_W, type EmojiLayer, type ImageLayer, type Layer, type ShapeLayer, type Slide, type StickerKind, type StickerLayer, type StoryDesign, type TextLayer } from './types';

let counter = 0;
export function uid(prefix = 'l'): string {
    counter += 1;
    return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const base = () => ({ rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 });

export function makeText(over: Partial<TextLayer> = {}): TextLayer {
    return {
        id: uid('t'), type: 'text', x: STORY_W / 2 - 400, y: 760, ...base(),
        text: 'Scrivi qui', fontFamily: 'Montserrat', fontSize: 96, bold: true, italic: false, fill: '#ffffff', align: 'center',
        width: 800, lineHeight: 1.15, letterSpacing: 0, uppercase: false, background: '', stroke: '', strokeWidth: 0, shadow: false,
        ...over,
    };
}

export function makeEmoji(text: string, over: Partial<EmojiLayer> = {}): EmojiLayer {
    return { id: uid('e'), type: 'emoji', x: STORY_W / 2 - 100, y: 800, ...base(), text, fontSize: 200, ...over };
}

export function makeImage(url: string, width: number, height: number, over: Partial<ImageLayer> = {}): ImageLayer {
    // Si adatta alla tela: mai più larga della storia
    const k = Math.min(1, STORY_W / width, STORY_H / height);
    const w = Math.round(width * k), h = Math.round(height * k);
    return { id: uid('i'), type: 'image', url, x: Math.round((STORY_W - w) / 2), y: Math.round((STORY_H - h) / 2), ...base(), width: w, height: h, cornerRadius: 0, ...over };
}

export function makeShape(shape: ShapeLayer['shape'], over: Partial<ShapeLayer> = {}): ShapeLayer {
    const size = shape === 'line' ? { width: 600, height: 0 } : shape === 'circle' ? { width: 400, height: 400 } : { width: 600, height: 360 };
    return {
        id: uid('s'), type: 'shape', shape, x: STORY_W / 2 - size.width / 2, y: 780, ...base(), ...size,
        fill: shape === 'line' ? '' : '#ec4899', stroke: shape === 'line' ? '#ffffff' : '', strokeWidth: shape === 'line' ? 12 : 0, cornerRadius: shape === 'rect' ? 32 : 0,
        ...over,
    };
}

export const STICKER_DEFAULTS: Record<StickerKind, { label: string; text: string; options: string[] }> = {
    link: { label: 'Link', text: 'wrdigital.it', options: [] },
    hashtag: { label: '#Hashtag', text: 'estate', options: [] },
    mention: { label: '@Menzione', text: 'wrdigital.agency', options: [] },
    location: { label: 'Luogo', text: 'Monza', options: [] },
    music: { label: 'Musica', text: 'Titolo del brano', options: [] },
    poll: { label: 'Sondaggio', text: 'Cosa preferisci?', options: ['Sì', 'No'] },
    question: { label: 'Domande', text: 'Fammi una domanda', options: [] },
    quiz: { label: 'Quiz', text: 'Qual è la risposta?', options: ['Risposta A', 'Risposta B'] },
    slider: { label: 'Slider', text: 'Quanto ti piace?', options: [] },
    countdown: { label: 'Conto alla rovescia', text: 'Open weekend', options: [] },
};

export function makeSticker(sticker: StickerKind, over: Partial<StickerLayer> = {}): StickerLayer {
    const d = STICKER_DEFAULTS[sticker];
    return { id: uid('k'), type: 'sticker', sticker, x: STORY_W / 2 - 330, y: 860, ...base(), text: d.text, options: [...d.options], ...over };
}

export function makeSlide(over: Partial<Slide> = {}): Slide {
    return { id: uid('slide'), name: 'Slide', background: { type: 'color', color: '#111827' }, layers: [], ...over };
}

export function emptyDesign(): StoryDesign {
    return { version: 2, slides: [makeSlide({ name: 'Slide 1' })] };
}

/** Copia una slide (per applicare un modello) con id nuovi per la slide e per ogni livello. */
export function cloneSlide(slide: Slide): Slide {
    return { ...slide, id: uid('slide'), layers: slide.layers.map((l) => ({ ...l, id: uid(l.type[0]) }) as Layer) };
}
