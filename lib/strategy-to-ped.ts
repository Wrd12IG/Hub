// Dalla riga del calendario di una Strategia social al contenuto del Piano editoriale.
// Il giro corretto: Strategia → contenuto nel PED (con data di uscita) → task di produzione calcolati all'indietro.
// Prima si creava un task con scadenza = giorno del post e un contenuto senza data: il contrario del flusso. Pura.

import type { ProductionType } from './content-production';

const MESI: Record<string, number> = {
    gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5,
    luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11,
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Data di uscita (yyyy-MM-dd) da come l'AI scrive il giorno: «2026-12-03», «03/12/2026», «Giovedì 3 Dicembre», «Lunedì 15».
 * Senza mese: il mese corrente, o il prossimo se il giorno è già passato. Con un mese già passato: l'anno dopo.
 * null se il testo non contiene una data riconoscibile (si lascia scegliere a una persona invece di inventare).
 */
export function parseStrategyDay(giorno: string | null | undefined, now: Date = new Date()): string | null {
    if (!giorno) return null;
    const text = giorno.trim();
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const it = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
    if (it) return ymd(new Date(Number(it[3]), Number(it[2]) - 1, Number(it[1])));

    const lower = text.toLowerCase();
    // «Settimana 2» non è un giorno del mese
    if (/settimana|week/.test(lower)) return null;
    const day = /\b(\d{1,2})\b/.exec(lower);
    const dayNum = day ? Number(day[1]) : NaN;
    if (!(dayNum >= 1 && dayNum <= 31)) return null;
    const monthKey = Object.keys(MESI).find((m) => lower.includes(m));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (monthKey === undefined) {
        const candidate = new Date(now.getFullYear(), now.getMonth(), dayNum);
        if (candidate < today) candidate.setMonth(candidate.getMonth() + 1);
        return ymd(candidate);
    }
    const candidate = new Date(now.getFullYear(), MESI[monthKey], dayNum);
    if (candidate < today) candidate.setFullYear(candidate.getFullYear() + 1);
    return ymd(candidate);
}

/** Che lavorazione serve per il formato scelto nella strategia. */
export function productionTypesForMedia(mediaType: string): ProductionType[] {
    const m = mediaType.toLowerCase();
    if (/video|reel/.test(m)) return ['video'];
    if (/foto/.test(m)) return ['photo'];
    return ['graphic'];
}

/** Canali del contenuto dal testo «piattaforma» della strategia. */
export function channelsFromPlatform(piattaforma: string, mediaType: string) {
    const p = piattaforma.toLowerCase();
    const isStory = p.includes('stor') || /storia/i.test(mediaType);
    return {
        facebook: p.includes('facebook'),
        instagram: p.includes('instagram') && !isStory,
        igStories: isStory,
        linkedin: p.includes('linkedin'),
        tiktok: p.includes('tiktok'),
        youtube: p.includes('youtube'),
    };
}
