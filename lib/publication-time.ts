/**
 * lib/publication-time.ts
 *
 * Data e ora di pubblicazione di un contenuto. Si salva "yyyy-MM-dd" quando l'ora non c'è (esce alle 09:00 di Roma, vedi
 * lib/publisher.ts) e un istante ISO quando c'è. Le funzioni lavorano sull'ora del computer di chi compila.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** "HH:mm" di una data di pubblicazione, o "" se contiene solo il giorno. */
export function timeOfPublication(value?: string): string {
    if (!value || !value.includes('T')) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Giorno scelto + ora "HH:mm" → valore da salvare. Senza ora (o con un'ora non valida) resta il solo giorno. */
export function combineDateAndTime(day: Date, time: string): string {
    const day10 = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec((time || '').trim());
    if (!m) return day10;
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(m[1]), Number(m[2])).toISOString();
}
