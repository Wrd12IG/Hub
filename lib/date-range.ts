// Intervalli di date scelti a mano nella Panoramica. Pura: nessun accesso a rete o a React.

export interface DateRange { from: string; to: string }
export type RangeCompare = 'prev_period' | 'prev_year' | 'none';

/** Oltre un anno le letture diventano lente e poco utili: un limite chiaro è meglio di un timeout. */
export const MAX_RANGE_DAYS = 366;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (iso: string) => new Date(`${iso}T00:00:00Z`);

function addDays(iso: string, n: number): string {
    const d = parse(iso);
    d.setUTCDate(d.getUTCDate() + n);
    return toIso(d);
}

/** Giorni compresi (estremi inclusi): dal 1 al 30 sono 30. */
export function rangeDays(from: string, to: string): number {
    return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000) + 1;
}

/** «Ultimi N giorni» come intervallo: da N-1 giorni fa a oggi. */
export function presetRange(days: number, now = new Date()): DateRange {
    const to = toIso(now);
    return { from: addDays(to, -(days - 1)), to };
}

export type RangeCheck = { ok: true; range: DateRange; days: number } | { ok: false; error: string };

export function validateRange(from: string | null | undefined, to: string | null | undefined, now = new Date()): RangeCheck {
    // Il giro andata e ritorno scarta i giorni che non esistono (31 febbraio): JavaScript li "correggerebbe" in silenzio al 3 marzo
    const real = (iso: string | null | undefined) => !!iso && ISO.test(iso) && !Number.isNaN(parse(iso).getTime()) && toIso(parse(iso)) === iso;
    if (!real(from) || !real(to)) {
        return { ok: false, error: 'Scegli una data di inizio e una di fine.' };
    }
    if (from! > to!) return { ok: false, error: 'La data di inizio deve essere prima di quella di fine.' };
    if (to! > toIso(now)) return { ok: false, error: 'La data di fine non può essere nel futuro.' };
    const days = rangeDays(from!, to!);
    if (days > MAX_RANGE_DAYS) return { ok: false, error: `Il periodo può durare al massimo ${MAX_RANGE_DAYS} giorni.` };
    return { ok: true, range: { from: from!, to: to! }, days };
}

/**
 * Finestra corrente e finestra di confronto per un intervallo scelto a mano.
 * - periodo precedente: lo stesso numero di giorni subito prima dell'inizio;
 * - anno precedente: le stesse date dell'anno prima.
 */
export function buildRangeWindows(from: string, to: string, compare: RangeCompare) {
    const current = { dateFrom: from, dateTo: to };
    if (compare === 'none') return { current, previous: null };
    if (compare === 'prev_year') {
        const shift = (iso: string) => { const d = parse(iso); d.setUTCFullYear(d.getUTCFullYear() - 1); return toIso(d); };
        return { current, previous: { dateFrom: shift(from), dateTo: shift(to) } };
    }
    const n = rangeDays(from, to);
    return { current, previous: { dateFrom: addDays(from, -n), dateTo: addDays(from, -1) } };
}

/** «dal 1 ott al 15 ott» per le didascalie. */
export function rangeLabel(from: string, to: string): string {
    const f = (iso: string) => parse(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return `dal ${f(from)} al ${f(to)}`;
}
