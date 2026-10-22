/**
 * lib/story-editor/serialize.ts
 *
 * Da/per il campo `storyData` del contenuto (testo JSON). Legge anche le bozze del vecchio editor (un elenco di livelli
 * su una tela 360×640), portandole nel nuovo formato (1080×1920, una slide). Pura.
 */
import { makeEmoji, makeImage, makeSlide, makeText, uid } from './factory';
import { STORY_H, STORY_W, type Layer, type Slide, type StoryDesign } from './types';

const OLD_SCALE = STORY_W / 360; // il vecchio editor lavorava a 360 pixel di larghezza

export function serializeDesign(design: StoryDesign): string {
    return JSON.stringify(design);
}

const isHttps = (u: unknown): u is string => typeof u === 'string' && /^https:\/\//i.test(u);

function migrateOld(layers: any[]): StoryDesign {
    const out: Layer[] = [];
    let background: Slide['background'] = { type: 'color', color: '#111827' };
    for (const l of layers) {
        if (!l || typeof l !== 'object') continue;
        const common = { x: (l.x || 0) * OLD_SCALE, y: (l.y || 0) * OLD_SCALE, rotation: l.rotation || 0, scaleX: l.scaleX ?? 1, scaleY: l.scaleY ?? 1 };
        if (l.type === 'text') {
            out.push(makeText({ ...common, text: String(l.content ?? ''), fontSize: Math.round((l.fontSize || 24) * OLD_SCALE), bold: l.fontWeight === 'bold', italic: l.fontStyle === 'italic', align: l.align || 'center', fill: l.color || '#ffffff', width: 800 }));
        } else if (l.type === 'sticker') {
            out.push(makeEmoji(String(l.content ?? '🙂'), { ...common, fontSize: Math.round((l.fontSize || 64) * OLD_SCALE) }));
        } else if (l.type === 'image' && isHttps(l.url)) {
            // Le immagini del vecchio editor erano indirizzi temporanei del browser (blob:): solo quelle https si possono recuperare
            const w = Math.round((l.width || 360) * OLD_SCALE), h = Math.round((l.height || 640) * OLD_SCALE);
            if (l.x === 0 && l.y === 0 && w >= STORY_W - 10) background = { type: 'image', url: l.url, fit: 'cover', blur: 0, dim: 0 };
            else out.push(makeImage(l.url, w, h, { ...common }));
        }
    }
    return { version: 2, slides: [makeSlide({ name: 'Slide 1', background, layers: out })] };
}

/** Il progetto salvato, in qualunque formato (testo JSON o oggetto, vecchio o nuovo); null se non si legge. */
export function parseStoryData(raw: unknown): StoryDesign | null {
    let data: unknown = raw;
    if (typeof raw === 'string') {
        try { data = JSON.parse(raw); } catch { return null; }
    }
    if (Array.isArray(data)) return migrateOld(data);
    const d = data as Partial<StoryDesign> | null;
    if (!d || d.version !== 2 || !Array.isArray(d.slides) || d.slides.length === 0) return null;
    const slides = d.slides.map((s) => ({
        id: s.id || uid('slide'),
        name: s.name || 'Slide',
        background: s.background || { type: 'color', color: '#111827' },
        layers: Array.isArray(s.layers) ? s.layers.filter((l) => l && typeof l === 'object' && typeof (l as Layer).type === 'string') : [],
    }));
    return { version: 2, slides };
}

export const STORY_SIZE = { width: STORY_W, height: STORY_H };
