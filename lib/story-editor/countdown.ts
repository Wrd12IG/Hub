/**
 * lib/story-editor/countdown.ts
 *
 * Il «conto alla rovescia» di una storia pubblicata via API è un'immagine ferma: non può scorrere. Perciò lo sticker disegnato
 * mostra la DATA di fine, scritta bene, invece di numeri che sembrano contare. Il conto alla rovescia vero si aggiunge
 * dall'app di Instagram, con la stessa data. Pura.
 */
const MONTHS = ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'];
const DAYS = ['DOMENICA', 'LUNEDÌ', 'MARTEDÌ', 'MERCOLEDÌ', 'GIOVEDÌ', 'VENERDÌ', 'SABATO'];

export interface CountdownEnd { day: string; time: string; weekday: string }

/** `endAt` come lo dà il campo data e ora del browser: «2026-10-25T18:00». Vuoto o non valido: null. */
export function formatCountdownEnd(endAt?: string): CountdownEnd | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(endAt || '');
    if (!m) return null;
    const [y, mo, d, hh, mm] = m.slice(1).map(Number);
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || hh > 23 || mm > 59) return null;
    const weekday = DAYS[new Date(y, mo - 1, d).getDay()];
    return { day: `${d} ${MONTHS[mo - 1]}`, time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, weekday };
}
