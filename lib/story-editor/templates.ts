/**
 * lib/story-editor/templates.ts
 *
 * Modelli di partenza per le storie: ognuno è una slide completa. Si adattano ai colori del cliente (`Palette`).
 * Tutto ciò che è importante sta fuori dalle fasce coperte dall'interfaccia di Instagram (SAFE_TOP / SAFE_BOTTOM).
 */
import { makeShape, makeSlide, makeSticker, makeText } from './factory';
import { STORY_H, STORY_W, type Slide } from './types';

export interface Palette { primary: string; secondary: string; dark: string; light: string }

export const DEFAULT_PALETTE: Palette = { primary: '#ec4899', secondary: '#f59e0b', dark: '#111827', light: '#ffffff' };

export interface StoryTemplate { id: string; name: string; build: (p: Palette) => Slide }

/** Distanza dal fondo per tenere il contenuto sopra la barra «Invia messaggio». */
export const SAFE_BOTTOM_PAD = 460;

const W = STORY_W;
const center = (width: number) => (W - width) / 2;

export const STORY_TEMPLATES: StoryTemplate[] = [
    {
        id: 'promo', name: 'Promo',
        build: (p) => makeSlide({
            name: 'Promo', background: { type: 'gradient', from: p.primary, to: p.dark, angle: 160 },
            layers: [
                makeText({ text: 'OFFERTA', x: center(900), y: 520, width: 900, fontSize: 150, fontFamily: 'Bebas Neue', bold: false, letterSpacing: 8, fill: p.light }),
                makeText({ text: 'Solo questo mese', x: center(800), y: 700, width: 800, fontSize: 84, fontFamily: 'Playfair Display', italic: true, fill: p.light }),
                makeText({ text: 'Scopri tutti i dettagli in negozio e online.', x: center(780), y: 920, width: 780, fontSize: 52, fontFamily: 'Poppins', bold: false, fill: p.light }),
                makeSticker('link', { text: 'wrdigital.it', x: center(660), y: 1260 }),
            ],
        }),
    },
    {
        id: 'evento', name: 'Evento',
        build: (p) => makeSlide({
            name: 'Evento', background: { type: 'color', color: p.dark },
            layers: [
                makeShape('rect', { x: 90, y: 480, width: W - 180, height: 6, fill: p.secondary, cornerRadius: 3 }),
                makeText({ text: 'OPEN WEEKEND', x: center(900), y: 540, width: 900, fontSize: 130, fontFamily: 'Anton', bold: false, fill: p.light }),
                makeText({ text: 'SABATO 25 E DOMENICA 26', x: center(900), y: 760, width: 900, fontSize: 64, fontFamily: 'Oswald', fill: p.secondary, letterSpacing: 4 }),
                makeText({ text: 'Vieni a trovarci: ti aspettiamo con le novità del mese.', x: center(760), y: 960, width: 760, fontSize: 50, fontFamily: 'Poppins', bold: false, fill: p.light }),
                makeSticker('countdown', { text: 'Open weekend', x: center(660), y: 1280 }),
            ],
        }),
    },
    {
        id: 'novita', name: 'Novità',
        build: (p) => makeSlide({
            name: 'Novità', background: { type: 'color', color: p.dark },
            layers: [
                makeShape('rect', { x: 0, y: STORY_H - 860, width: W, height: 860, fill: p.primary, cornerRadius: 0 }),
                makeText({ text: 'NOVITÀ', x: 90, y: STORY_H - 760, width: 600, fontSize: 56, fontFamily: 'Oswald', fill: p.light, letterSpacing: 10, align: 'left', background: p.dark }),
                makeText({ text: 'È arrivato il nuovo modello', x: 90, y: STORY_H - 640, width: 900, fontSize: 104, fontFamily: 'Montserrat', fill: p.light, align: 'left' }),
                makeSticker('mention', { text: 'wrdigital.agency', x: 90, y: STORY_H - SAFE_BOTTOM_PAD }),
            ],
        }),
    },
    {
        id: 'citazione', name: 'Citazione',
        build: (p) => makeSlide({
            name: 'Citazione', background: { type: 'gradient', from: p.secondary, to: p.primary, angle: 135 },
            layers: [
                makeText({ text: '“', x: 90, y: 440, width: 300, fontSize: 380, fontFamily: 'Playfair Display', fill: p.light, align: 'left', opacity: 0.6 }),
                makeText({ text: 'Le grandi idee iniziano da una piccola storia.', x: center(820), y: 780, width: 820, fontSize: 88, fontFamily: 'Playfair Display', italic: true, bold: false, fill: p.light }),
                makeText({ text: '— IL TUO MARCHIO', x: center(820), y: 1240, width: 820, fontSize: 44, fontFamily: 'Oswald', fill: p.light, letterSpacing: 6 }),
            ],
        }),
    },
    {
        id: 'sondaggio', name: 'Sondaggio',
        build: (p) => makeSlide({
            name: 'Sondaggio', background: { type: 'gradient', from: p.dark, to: p.primary, angle: 200 },
            layers: [
                makeText({ text: 'Tu cosa preferisci?', x: center(860), y: 520, width: 860, fontSize: 110, fontFamily: 'Montserrat', fill: p.light }),
                makeSticker('poll', { text: 'Rosso o blu?', options: ['Rosso', 'Blu'], x: center(660), y: 900 }),
            ],
        }),
    },
    {
        id: 'prezzo', name: 'Prezzo',
        build: (p) => makeSlide({
            name: 'Prezzo', background: { type: 'color', color: p.light },
            layers: [
                makeShape('circle', { x: center(760), y: 520, width: 760, height: 760, fill: p.primary }),
                makeText({ text: 'a partire da', x: center(600), y: 700, width: 600, fontSize: 52, fontFamily: 'Poppins', bold: false, fill: p.light }),
                makeText({ text: '€ 199', x: center(700), y: 800, width: 700, fontSize: 190, fontFamily: 'Anton', bold: false, fill: p.light }),
                makeText({ text: 'al mese · IVA esclusa', x: center(600), y: 1060, width: 600, fontSize: 44, fontFamily: 'Poppins', bold: false, fill: p.light }),
                makeSticker('link', { text: 'Scopri di più', x: center(660), y: 1400 }),
            ],
        }),
    },
    {
        id: 'domande', name: 'Domande',
        build: (p) => makeSlide({
            name: 'Domande', background: { type: 'gradient', from: p.secondary, to: p.dark, angle: 180 },
            layers: [
                makeText({ text: 'CHIEDICI TUTTO', x: center(900), y: 560, width: 900, fontSize: 120, fontFamily: 'Bebas Neue', bold: false, letterSpacing: 6, fill: p.light }),
                makeSticker('question', { text: 'Fammi una domanda', x: center(660), y: 880 }),
            ],
        }),
    },
    {
        id: 'minimal', name: 'Minimal',
        build: (p) => makeSlide({
            name: 'Minimal', background: { type: 'color', color: p.light },
            layers: [
                makeText({ text: 'Buongiorno', x: center(860), y: 800, width: 860, fontSize: 140, fontFamily: 'Pacifico', bold: false, fill: p.dark }),
                makeShape('line', { x: center(240), y: 1040, width: 240, strokeWidth: 8, stroke: p.primary }),
            ],
        }),
    },
];

export function findTemplate(id: string): StoryTemplate | undefined {
    return STORY_TEMPLATES.find((t) => t.id === id);
}
