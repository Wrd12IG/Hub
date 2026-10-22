/**
 * lib/story-editor/reducer.ts
 *
 * Lo stato dell'editor delle storie, con annulla e ripeti. Pura (nessun I/O, nessun React): si testa senza interfaccia.
 * Gli spostamenti con il mouse e la digitazione arrivano come tanti aggiornamenti: quelli con la stessa `key` (la «chiave
 * del gesto») contano come UN passo di annulla/ripeti. Qualunque altra azione chiude il gesto.
 */
import type { Background, Layer, Slide, StoryDesign } from './types';

export interface EditorState {
    design: StoryDesign;
    slideId: string;
    selectedId: string | null;
    past: StoryDesign[];
    future: StoryDesign[];
    /** Il progetto è diverso da quello caricato o salvato. */
    dirty: boolean;
    /** Chiave del gesto in corso (trascinamento, digitazione): gli aggiornamenti con la stessa chiave non aggiungono passi. */
    lastKey: string | null;
}

export type EditorAction =
    | { type: 'LOAD'; design: StoryDesign }
    | { type: 'SELECT_SLIDE'; slideId: string }
    | { type: 'SELECT_LAYER'; layerId: string | null }
    | { type: 'ADD_LAYER'; layer: Layer }
    | { type: 'UPDATE_LAYER'; layerId: string; patch: Partial<Layer>; key?: string }
    | { type: 'REMOVE_LAYER'; layerId: string }
    | { type: 'DUPLICATE_LAYER'; layerId: string; newId: string }
    | { type: 'MOVE_LAYER'; layerId: string; direction: 'up' | 'down' | 'top' | 'bottom' }
    | { type: 'ADD_SLIDE'; slide: Slide }
    | { type: 'DUPLICATE_SLIDE'; slideId: string; newId: string; idFor: (oldLayerId: string) => string }
    | { type: 'REMOVE_SLIDE'; slideId: string }
    | { type: 'MOVE_SLIDE'; slideId: string; toIndex: number }
    | { type: 'SET_BACKGROUND'; background: Background; key?: string }
    | { type: 'APPLY_SLIDE'; slide: Slide }
    | { type: 'RENAME_SLIDE'; slideId: string; name: string }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'MARK_SAVED' };

const HISTORY_LIMIT = 80;

export function initialState(design: StoryDesign): EditorState {
    return { design, slideId: design.slides[0].id, selectedId: null, past: [], future: [], dirty: false, lastKey: null };
}

/** Registra lo stato attuale nella storia, prima di cambiarlo. */
function push(state: EditorState, next: StoryDesign, key: string | null = null): EditorState {
    return {
        ...state,
        design: next,
        past: [...state.past, state.design].slice(-HISTORY_LIMIT),
        future: [],
        dirty: true,
        lastKey: key,
    };
}

/** Un aggiornamento con una chiave: se è la stessa del gesto in corso si aggiorna soltanto, altrimenti inizia un nuovo passo. */
function gesture(state: EditorState, next: StoryDesign, key: string | undefined): EditorState {
    if (key && key === state.lastKey) return { ...state, design: next, dirty: true };
    return push(state, next, key ?? null);
}

const mapSlide = (design: StoryDesign, slideId: string, fn: (s: Slide) => Slide): StoryDesign => ({
    ...design,
    slides: design.slides.map((s) => (s.id === slideId ? fn(s) : s)),
});

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
    switch (action.type) {
        case 'LOAD':
            return initialState(action.design);

        case 'SELECT_SLIDE':
            return state.design.slides.some((s) => s.id === action.slideId) ? { ...state, slideId: action.slideId, selectedId: null, lastKey: null } : state;

        case 'SELECT_LAYER':
            return { ...state, selectedId: action.layerId, lastKey: null };

        case 'ADD_LAYER': {
            const next = mapSlide(state.design, state.slideId, (s) => ({ ...s, layers: [...s.layers, action.layer] }));
            return { ...push(state, next), selectedId: action.layer.id };
        }

        case 'UPDATE_LAYER': {
            const next = mapSlide(state.design, state.slideId, (s) => ({
                ...s,
                layers: s.layers.map((l) => (l.id === action.layerId ? ({ ...l, ...action.patch } as Layer) : l)),
            }));
            return gesture(state, next, action.key);
        }

        case 'REMOVE_LAYER': {
            const next = mapSlide(state.design, state.slideId, (s) => ({ ...s, layers: s.layers.filter((l) => l.id !== action.layerId) }));
            return { ...push(state, next), selectedId: state.selectedId === action.layerId ? null : state.selectedId };
        }

        case 'DUPLICATE_LAYER': {
            const slide = state.design.slides.find((s) => s.id === state.slideId);
            const src = slide?.layers.find((l) => l.id === action.layerId);
            if (!slide || !src) return state;
            const copy = { ...src, id: action.newId, x: src.x + 40, y: src.y + 40 } as Layer;
            const idx = slide.layers.indexOf(src);
            const next = mapSlide(state.design, state.slideId, (s) => ({ ...s, layers: [...s.layers.slice(0, idx + 1), copy, ...s.layers.slice(idx + 1)] }));
            return { ...push(state, next), selectedId: copy.id };
        }

        case 'MOVE_LAYER': {
            const slide = state.design.slides.find((s) => s.id === state.slideId);
            if (!slide) return state;
            const i = slide.layers.findIndex((l) => l.id === action.layerId);
            if (i < 0) return state;
            const target = action.direction === 'up' ? i + 1 : action.direction === 'down' ? i - 1 : action.direction === 'top' ? slide.layers.length - 1 : 0;
            if (target < 0 || target >= slide.layers.length || target === i) return state;
            const layers = [...slide.layers];
            const [item] = layers.splice(i, 1);
            layers.splice(target, 0, item);
            return push(state, mapSlide(state.design, state.slideId, (s) => ({ ...s, layers })));
        }

        case 'ADD_SLIDE': {
            const idx = state.design.slides.findIndex((s) => s.id === state.slideId);
            const slides = [...state.design.slides.slice(0, idx + 1), action.slide, ...state.design.slides.slice(idx + 1)];
            return { ...push(state, { ...state.design, slides }), slideId: action.slide.id, selectedId: null };
        }

        case 'DUPLICATE_SLIDE': {
            const idx = state.design.slides.findIndex((s) => s.id === action.slideId);
            if (idx < 0) return state;
            const src = state.design.slides[idx];
            const copy: Slide = { ...src, id: action.newId, name: `${src.name} (copia)`, layers: src.layers.map((l) => ({ ...l, id: action.idFor(l.id) }) as Layer) };
            const slides = [...state.design.slides.slice(0, idx + 1), copy, ...state.design.slides.slice(idx + 1)];
            return { ...push(state, { ...state.design, slides }), slideId: copy.id, selectedId: null };
        }

        case 'REMOVE_SLIDE': {
            if (state.design.slides.length <= 1) return state; // una storia ha sempre almeno una slide
            const idx = state.design.slides.findIndex((s) => s.id === action.slideId);
            if (idx < 0) return state;
            const slides = state.design.slides.filter((s) => s.id !== action.slideId);
            const slideId = state.slideId === action.slideId ? slides[Math.min(idx, slides.length - 1)].id : state.slideId;
            return { ...push(state, { ...state.design, slides }), slideId, selectedId: null };
        }

        case 'MOVE_SLIDE': {
            const from = state.design.slides.findIndex((s) => s.id === action.slideId);
            const to = Math.max(0, Math.min(state.design.slides.length - 1, action.toIndex));
            if (from < 0 || from === to) return state;
            const slides = [...state.design.slides];
            const [item] = slides.splice(from, 1);
            slides.splice(to, 0, item);
            return push(state, { ...state.design, slides });
        }

        case 'SET_BACKGROUND': {
            const next = mapSlide(state.design, state.slideId, (s) => ({ ...s, background: action.background }));
            return gesture(state, next, action.key);
        }

        case 'APPLY_SLIDE': {
            // Un modello sostituisce il contenuto della slide corrente, tenendone l'id
            const next = mapSlide(state.design, state.slideId, (s) => ({ ...s, background: action.slide.background, layers: action.slide.layers }));
            return { ...push(state, next), selectedId: null };
        }

        case 'RENAME_SLIDE':
            return push(state, mapSlide(state.design, action.slideId, (s) => ({ ...s, name: action.name })));

        case 'UNDO': {
            if (state.past.length === 0) return state;
            const previous = state.past[state.past.length - 1];
            const slideId = previous.slides.some((s) => s.id === state.slideId) ? state.slideId : previous.slides[0].id;
            return { ...state, design: previous, past: state.past.slice(0, -1), future: [state.design, ...state.future], slideId, selectedId: null, dirty: true, lastKey: null };
        }

        case 'REDO': {
            if (state.future.length === 0) return state;
            const next = state.future[0];
            const slideId = next.slides.some((s) => s.id === state.slideId) ? state.slideId : next.slides[0].id;
            return { ...state, design: next, past: [...state.past, state.design], future: state.future.slice(1), slideId, selectedId: null, dirty: true, lastKey: null };
        }

        case 'MARK_SAVED':
            return { ...state, dirty: false, lastKey: null };

        default:
            return state;
    }
}
