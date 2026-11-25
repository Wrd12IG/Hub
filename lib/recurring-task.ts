/**
 * lib/recurring-task.ts
 *
 * Due cose che i modelli di task ricorrente non sapevano fare. Pura (nessun I/O).
 *
 * 1) SEGNAPOSTO nel titolo. Prima ogni mese nasceva «Report mensile» identico al precedente e nello storico non si
 *    distinguevano. Ora il titolo può contenere:
 *      {mese}  novembre      {periodo}  novembre 2026     {anno}  2026
 *      {trimestre}  T4 2026  {settimana}  sett. 48
 *    con uno scarto facoltativo: {mese-1} (il mese scorso), {periodo+1} (il prossimo), {trimestre-1}, {settimana+1}…
 *    Lo scarto serve perché un report si scrive DOPO il mese: creato il 3 dicembre, «Report – {periodo-1}» dice novembre.
 *
 * 2) ANTICIPO della scadenza. Prima il task scadeva il giorno stesso in cui nasceva. Ora il modello può dire «scade dopo
 *    N giorni lavorativi» (0 = come prima). Si contano solo lunedì-venerdì: le festività non si conoscono.
 */
import { addMonths, addWeeks, addYears, format, getISOWeek, getQuarter, getYear } from 'date-fns';
import { it } from 'date-fns/locale';

const TOKEN = /\{(mese|periodo|anno|trimestre|settimana)([+-]\d{1,3})?\}/gi;

function resolveToken(name: string, offset: number, ref: Date): string {
    switch (name.toLowerCase()) {
        case 'mese': return format(addMonths(ref, offset), 'LLLL', { locale: it });
        case 'periodo': return format(addMonths(ref, offset), 'LLLL yyyy', { locale: it });
        case 'anno': return String(getYear(addYears(ref, offset)));
        case 'trimestre': {
            const d = addMonths(ref, offset * 3);
            return `T${getQuarter(d)} ${getYear(d)}`;
        }
        default: return `sett. ${getISOWeek(addWeeks(ref, offset))}`; // settimana
    }
}

/** Sostituisce i segnaposto con la data di riferimento (il giorno in cui il task nasce). Ciò che non riconosce resta com'è. */
export function expandTitleTokens(text: string, ref: Date): string {
    return text.replace(TOKEN, (_m, name: string, off?: string) => resolveToken(name, off ? parseInt(off, 10) : 0, ref));
}

/** Aggiunge `n` giorni lavorativi (lunedì-venerdì). Con `n` ≤ 0 restituisce lo stesso giorno. Non modifica `date`. */
export function addWorkingDays(date: Date, n: number): Date {
    const d = new Date(date);
    let left = Math.max(0, Math.trunc(n));
    while (left > 0) {
        d.setDate(d.getDate() + 1);
        const day = d.getDay();
        if (day !== 0 && day !== 6) left--;
    }
    return d;
}

export const MAX_DUE_OFFSET_DAYS = 30;

/** Il valore salvato nel modello, reso sicuro: intero tra 0 e 30; qualunque altra cosa vale 0 (nessun anticipo). */
export function sanitizeDueOffset(value: unknown): number {
    const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : 0;
    if (!Number.isFinite(n)) return 0;
    return Math.min(MAX_DUE_OFFSET_DAYS, Math.max(0, Math.trunc(n)));
}
