/**
 * lib/kpi-weekly.ts
 *
 * Il confronto SETTIMANA SU SETTIMANA: ogni settimana del mese contro la stessa settimana del mese prima. Serve a dare il tempo
 * di correggere PRIMA che il mese finisca (un calo si vede alla fine della seconda settimana, non il giorno 3 del mese dopo).
 *
 * Settimane = blocchi di 7 giorni dal 1° del mese (decisione di prodotto, 17/11/2026):
 *   1: 1-7 · 2: 8-14 · 3: 15-21 · 4: 22-28 · 5: 29-fine (2 o 3 giorni, solo nei mesi da 30/31 giorni).
 * Coprono tutto il mese e fanno sempre 7 giorni contro 7 giorni. La settimana N si confronta con la settimana N del mese prima, e
 * solo se hanno la stessa lunghezza (la 5ª di un mese da 31 giorni non si confronta con la 5ª di uno da 30: sarebbero 3 giorni
 * contro 2, e il «+50%» sarebbe un'invenzione).
 *
 * Solo funzioni pure (si provano con dati finti, lib/__tests__/kpi-weekly.test.ts). Chi legge le piattaforme è lib/kpi-monthly.ts.
 * I dati reali inseriti a mano (lead, appuntamenti, test drive, vendite) sono MENSILI: nelle settimane non ci sono, e i lead
 * ripiegano sulla stima di Meta, dichiarata come tale.
 */

import type { PlatformReport } from './reporting';
import { KPI_CATALOG } from './kpi-profiles';
import { compareDelta, monthRange, rawKpi, shiftMonth, verdictOf, type Delta, type DateRange, type KpiResult, type VerdictState } from './kpi-compute';

const pad = (n: number) => String(n).padStart(2, '0');

export interface WeekBlock extends DateRange { n: number; days: number }

/** Le settimane del mese: 4 (febbraio) o 5. */
export function weekBlocks(month: string): WeekBlock[] {
    const last = Number(monthRange(month).dateTo.slice(8, 10));
    const out: WeekBlock[] = [];
    for (let start = 1, n = 1; start <= last; start += 7, n++) {
        const end = Math.min(start + 6, last);
        out.push({ n, dateFrom: `${month}-${pad(start)}`, dateTo: `${month}-${pad(end)}`, days: end - start + 1 });
    }
    return out;
}

/** La stessa settimana del mese prima, solo se esiste ed è lunga uguale; altrimenti null (nessun confronto). */
export function weekComparison(month: string, n: number): WeekBlock | null {
    const cur = weekBlocks(month).find((b) => b.n === n);
    const prev = weekBlocks(shiftMonth(month, -1)).find((b) => b.n === n);
    return cur && prev && cur.days === prev.days ? prev : null;
}

/** Le settimane già chiuse: una settimana in corso non si giudica (sarebbe 3 giorni contro 7). `today` è «AAAA-MM-GG» di Roma. */
export function completedBlocks(month: string, today: string): WeekBlock[] {
    return weekBlocks(month).filter((b) => b.dateTo < today);
}

export interface MonthWindows {
    current: DateRange;
    previous: DateRange;
    yoy: DateRange;
    /** Mese in corso: finestre ridotte ai giorni già chiusi (dal 1° a ieri) e confrontate con gli stessi giorni. */
    partial: boolean;
    /** Giorni compresi nella finestra del mese. */
    days: number;
}

/** Un intervallo «i primi N giorni» di un mese, senza uscire dal mese. */
function firstDays(month: string, n: number): DateRange {
    const full = monthRange(month);
    const last = Number(full.dateTo.slice(8, 10));
    return { dateFrom: full.dateFrom, dateTo: `${month}-${pad(Math.min(n, last))}` };
}

/**
 * Le finestre per il calcolo del mese. Un mese chiuso: il mese intero contro il mese prima e lo stesso mese dell'anno scorso.
 * Il mese in corso: i giorni già chiusi (fino a ieri) contro gli stessi giorni del mese prima e dell'anno scorso, così «a metà
 * mese» il confronto è fra cose uguali. null se il mese non è ancora iniziato (o è nel futuro): niente da confrontare.
 * `today` è «AAAA-MM-GG» di Roma.
 */
export function monthWindows(month: string, today: string): MonthWindows | null {
    const full = monthRange(month);
    const prev = shiftMonth(month, -1);
    const yoy = shiftMonth(month, -12);
    if (today > full.dateTo) {
        return { current: full, previous: monthRange(prev), yoy: monthRange(yoy), partial: false, days: Number(full.dateTo.slice(8, 10)) };
    }
    if (today < full.dateFrom) return null;
    const days = Number(today.slice(8, 10)) - 1;
    if (days < 1) return null;
    return { current: firstDays(month, days), previous: firstDays(prev, days), yoy: firstDays(yoy, days), partial: true, days };
}

/* ───────────── calcolo ───────────── */

export interface WeekKpi {
    id: string;
    value: number | null;
    previous: number | null;
    /** `proxy` = stima di piattaforma al posto del dato reale (i lead). */
    kind: 'real' | 'proxy' | null;
    vsPrev: Delta | null;
}

export interface WeekResult {
    n: number;
    dateFrom: string;
    dateTo: string;
    days: number;
    /** Esiste la stessa settimana del mese prima, lunga uguale. */
    comparable: boolean;
    /** La lettura delle piattaforme per questa settimana è fallita: nessun numero (non zeri). */
    unavailable?: boolean;
    kpis: WeekKpi[];
    verdict: VerdictState;
}

export interface WeekInput {
    block: WeekBlock;
    comparable: boolean;
    /** Report della settimana (`rows`) con la settimana del mese prima (`previousRows`). null = lettura fallita. */
    reports: PlatformReport[] | null;
}

/**
 * I KPI che hanno senso a settimane: quelli che arrivano da una piattaforma, più i lead (dato reale mensile, ma con la stima di
 * Meta come ripiego: a settimane si vede quella, dichiarata). Appuntamenti, test drive e vendite sono solo mensili: restano fuori.
 */
export const weeklyKpiIds = (kpiIds: string[]): string[] =>
    kpiIds.filter((id) => KPI_CATALOG[id] && (KPI_CATALOG[id].source !== 'manual' || !!KPI_CATALOG[id].fallbackId));

export function computeWeeks(kpiIds: string[], weeks: WeekInput[]): WeekResult[] {
    const ids = weeklyKpiIds(kpiIds);
    return weeks.map(({ block, comparable, reports }): WeekResult => {
        const base = { n: block.n, dateFrom: block.dateFrom, dateTo: block.dateTo, days: block.days, comparable };
        if (!reports) return { ...base, unavailable: true, kpis: [], verdict: 'unknown' };

        const kpis: WeekKpi[] = ids.map((id) => {
            const def = KPI_CATALOG[id];
            const cur = rawKpi(id, reports, 'current', undefined);
            const prev = comparable ? rawKpi(id, reports, 'previous', undefined) : { value: null, kind: null };
            // Reale con reale, stima con stima: mai un confronto fra due grandezze diverse
            const same = cur.value !== null && prev.value !== null && cur.kind === prev.kind;
            return { id, value: cur.value, previous: prev.value, kind: cur.kind, vsPrev: same ? compareDelta(cur.value, prev.value, def.unit, def.better) : null };
        });

        // Il giudizio della settimana lo dà lo stesso criterio del mese (primo KPI confrontabile con numeri non troppo piccoli)
        const asResults: KpiResult[] = kpis.map((k) => {
            const def = KPI_CATALOG[k.id];
            return { id: k.id, label: def.label, unit: def.unit, better: def.better, value: k.value, kind: k.kind, previous: k.previous, yoy: null, vsPrev: k.vsPrev, vsYoy: null };
        });
        return { ...base, kpis, verdict: verdictOf(asResults).state };
    });
}
