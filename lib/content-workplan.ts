/**
 * lib/content-workplan.ts
 *
 * Dalla data di pubblicazione di un contenuto ai task di lavorazione, calcolati all'indietro in giorni lavorativi.
 * Pura (nessun I/O): la finestra in components/ContentWorkplanDialog.tsx mostra la proposta e una persona la conferma,
 * compreso l'assegnatario — l'Hub propone, non decide.
 */

export interface WorkStep {
    key: string;
    title: string;
    /** Giorni lavorativi prima della pubblicazione (0 = il giorno stesso). */
    daysBefore: number;
    /** Minuti stimati. */
    minutes: number;
}

export const DEFAULT_STEPS: WorkStep[] = [
    { key: 'copy', title: 'Copy e piano del contenuto', daysBefore: 7, minutes: 60 },
    { key: 'creative', title: 'Grafica / creatività', daysBefore: 5, minutes: 120 },
    { key: 'review', title: 'Revisione interna', daysBefore: 3, minutes: 30 },
    { key: 'client', title: 'Invio e approvazione cliente', daysBefore: 2, minutes: 15 },
    { key: 'publish', title: 'Programmazione e pubblicazione', daysBefore: 0, minutes: 20 },
];

export interface ProposedTask {
    key: string;
    title: string;
    /** yyyy-MM-dd */
    dueDate: string;
    minutes: number;
    /** La scadenza ideale era già passata: si propone oggi, ma il lavoro parte in ritardo. */
    late: boolean;
}

const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Sposta indietro di `n` giorni lavorativi (sabato e domenica non contano). Lavora in UTC su date pure. */
export function subtractWorkingDays(from: Date, n: number): Date {
    const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
    while (isWeekend(d)) d.setUTCDate(d.getUTCDate() - 1); // un weekend di partenza vale come il venerdì prima
    let left = n;
    while (left > 0) {
        d.setUTCDate(d.getUTCDate() - 1);
        if (!isWeekend(d)) left--;
    }
    return d;
}

/**
 * Proposta di task per un contenuto. `today` è passato da fuori (yyyy-MM-dd) per poterlo testare.
 * Una data di pubblicazione già passata non ha senso pianificarla all'indietro: restituisce null.
 */
export function proposeWorkplan(publicationDate: string | undefined, today: string, steps: WorkStep[] = DEFAULT_STEPS): ProposedTask[] | null {
    const pub = /^(\d{4}-\d{2}-\d{2})/.exec(publicationDate || '')?.[1];
    if (!pub || pub < today) return null;
    const pubDate = new Date(`${pub}T00:00:00Z`);
    return steps.map((s) => {
        const due = ymd(subtractWorkingDays(pubDate, s.daysBefore));
        return { key: s.key, title: s.title, dueDate: due < today ? today : due, minutes: s.minutes, late: due < today };
    });
}
