import { describe, it, expect } from 'vitest';
import { editorReducer, initialState, type EditorState } from '../reducer';
import type { Layer, Slide, StoryDesign, TextLayer } from '../types';

const text = (id: string, o: Partial<TextLayer> = {}): TextLayer => ({
    id, type: 'text', x: 100, y: 100, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, text: id, fontFamily: 'Inter', fontSize: 64,
    bold: false, italic: false, fill: '#fff', align: 'left', width: 600, lineHeight: 1.2, letterSpacing: 0, uppercase: false,
    background: '', stroke: '', strokeWidth: 0, shadow: false, ...o,
});
const slide = (id: string, layers: Layer[] = []): Slide => ({ id, name: id, background: { type: 'color', color: '#000' }, layers });
const design = (...slides: Slide[]): StoryDesign => ({ version: 2, slides });
const start = (): EditorState => initialState(design(slide('s1'), slide('s2')));
const cur = (st: EditorState) => st.design.slides.find((s) => s.id === st.slideId)!;

describe('livelli', () => {
    it('aggiungere seleziona il nuovo livello', () => {
        const st = editorReducer(start(), { type: 'ADD_LAYER', layer: text('a') });
        expect(cur(st).layers.map((l) => l.id)).toEqual(['a']);
        expect(st.selectedId).toBe('a');
        expect(st.dirty).toBe(true);
    });
    it('rimuovere deseleziona se era selezionato', () => {
        let st = editorReducer(start(), { type: 'ADD_LAYER', layer: text('a') });
        st = editorReducer(st, { type: 'REMOVE_LAYER', layerId: 'a' });
        expect(cur(st).layers).toEqual([]);
        expect(st.selectedId).toBeNull();
    });
    it('duplicare mette la copia subito sopra, spostata, e la seleziona', () => {
        let st = editorReducer(start(), { type: 'ADD_LAYER', layer: text('a') });
        st = editorReducer(st, { type: 'ADD_LAYER', layer: text('b') });
        st = editorReducer(st, { type: 'DUPLICATE_LAYER', layerId: 'a', newId: 'a2' });
        expect(cur(st).layers.map((l) => l.id)).toEqual(['a', 'a2', 'b']);
        expect(cur(st).layers[1]).toMatchObject({ x: 140, y: 140 });
        expect(st.selectedId).toBe('a2');
    });
    it('ordine dei livelli: su, giù, in cima, in fondo, e ai bordi non succede nulla', () => {
        let st = start();
        for (const id of ['a', 'b', 'c']) st = editorReducer(st, { type: 'ADD_LAYER', layer: text(id) });
        st = editorReducer(st, { type: 'MOVE_LAYER', layerId: 'a', direction: 'up' });
        expect(cur(st).layers.map((l) => l.id)).toEqual(['b', 'a', 'c']);
        st = editorReducer(st, { type: 'MOVE_LAYER', layerId: 'a', direction: 'top' });
        expect(cur(st).layers.map((l) => l.id)).toEqual(['b', 'c', 'a']);
        st = editorReducer(st, { type: 'MOVE_LAYER', layerId: 'a', direction: 'bottom' });
        expect(cur(st).layers.map((l) => l.id)).toEqual(['a', 'b', 'c']);
        const same = editorReducer(st, { type: 'MOVE_LAYER', layerId: 'a', direction: 'down' });
        expect(same).toBe(st);
    });
});

describe('annulla e ripeti', () => {
    it('annulla e ripristina un passo', () => {
        let st = editorReducer(start(), { type: 'ADD_LAYER', layer: text('a') });
        st = editorReducer(st, { type: 'UNDO' });
        expect(cur(st).layers).toEqual([]);
        st = editorReducer(st, { type: 'REDO' });
        expect(cur(st).layers.map((l) => l.id)).toEqual(['a']);
    });
    it('un trascinamento (stessa chiave) è UN solo passo', () => {
        let st = editorReducer(start(), { type: 'ADD_LAYER', layer: text('a') });
        for (const x of [110, 150, 200, 260]) st = editorReducer(st, { type: 'UPDATE_LAYER', layerId: 'a', patch: { x }, key: 'drag:a:1' });
        expect(cur(st).layers[0]).toMatchObject({ x: 260 });
        st = editorReducer(st, { type: 'UNDO' });
        expect(cur(st).layers[0]).toMatchObject({ x: 100 }); // torna alla posizione di PRIMA del trascinamento
    });
    it('un nuovo gesto con un\'altra chiave è un nuovo passo', () => {
        let st = editorReducer(start(), { type: 'ADD_LAYER', layer: text('a') });
        st = editorReducer(st, { type: 'UPDATE_LAYER', layerId: 'a', patch: { x: 200 }, key: 'drag:a:1' });
        st = editorReducer(st, { type: 'UPDATE_LAYER', layerId: 'a', patch: { x: 400 }, key: 'drag:a:2' });
        st = editorReducer(st, { type: 'UNDO' });
        expect(cur(st).layers[0]).toMatchObject({ x: 200 });
    });
    it('una nuova modifica azzera il ripeti', () => {
        let st = editorReducer(start(), { type: 'ADD_LAYER', layer: text('a') });
        st = editorReducer(st, { type: 'UNDO' });
        st = editorReducer(st, { type: 'ADD_LAYER', layer: text('b') });
        expect(st.future).toEqual([]);
    });
    it('annulla senza storia non fa nulla', () => {
        const st = start();
        expect(editorReducer(st, { type: 'UNDO' })).toBe(st);
    });
});

describe('slide', () => {
    it('aggiungere mette la slide dopo quella corrente e la apre', () => {
        const st = editorReducer(start(), { type: 'ADD_SLIDE', slide: slide('s3') });
        expect(st.design.slides.map((s) => s.id)).toEqual(['s1', 's3', 's2']);
        expect(st.slideId).toBe('s3');
    });
    it('duplicare copia i livelli con id nuovi', () => {
        let st = editorReducer(start(), { type: 'ADD_LAYER', layer: text('a') });
        st = editorReducer(st, { type: 'DUPLICATE_SLIDE', slideId: 's1', newId: 'sx', idFor: (id) => `${id}-copia` });
        expect(st.design.slides.map((s) => s.id)).toEqual(['s1', 'sx', 's2']);
        expect(st.design.slides[1].layers.map((l) => l.id)).toEqual(['a-copia']);
        expect(st.design.slides[0].layers.map((l) => l.id)).toEqual(['a']);
    });
    it('non si può eliminare l\'ultima slide', () => {
        const only = initialState(design(slide('s1')));
        expect(editorReducer(only, { type: 'REMOVE_SLIDE', slideId: 's1' })).toBe(only);
    });
    it('eliminare la slide aperta apre quella vicina', () => {
        const st = editorReducer(start(), { type: 'REMOVE_SLIDE', slideId: 's1' });
        expect(st.design.slides.map((s) => s.id)).toEqual(['s2']);
        expect(st.slideId).toBe('s2');
    });
    it('riordinare sposta la slide', () => {
        const st = editorReducer(start(), { type: 'MOVE_SLIDE', slideId: 's1', toIndex: 1 });
        expect(st.design.slides.map((s) => s.id)).toEqual(['s2', 's1']);
    });
    it('i livelli sono della slide corrente', () => {
        let st = editorReducer(start(), { type: 'SELECT_SLIDE', slideId: 's2' });
        st = editorReducer(st, { type: 'ADD_LAYER', layer: text('a') });
        expect(st.design.slides[0].layers).toEqual([]);
        expect(st.design.slides[1].layers.map((l) => l.id)).toEqual(['a']);
    });
});

describe('sfondo e modelli', () => {
    it('cambia lo sfondo della slide corrente', () => {
        const st = editorReducer(start(), { type: 'SET_BACKGROUND', background: { type: 'color', color: '#ff0000' } });
        expect(cur(st).background).toEqual({ type: 'color', color: '#ff0000' });
    });
    it('un modello sostituisce il contenuto ma tiene l\'id della slide', () => {
        const tpl = slide('modello', [text('t1')]);
        tpl.background = { type: 'gradient', from: '#000', to: '#fff', angle: 90 };
        const st = editorReducer(start(), { type: 'APPLY_SLIDE', slide: tpl });
        expect(cur(st).id).toBe('s1');
        expect(cur(st).layers.map((l) => l.id)).toEqual(['t1']);
        expect(cur(st).background.type).toBe('gradient');
    });
});
