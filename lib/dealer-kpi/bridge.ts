/**
 * lib/dealer-kpi/bridge.ts
 *
 * Il ponte tra lo Sheet del cliente e i «dati reali» del mese (pagina Dati reali e mail mensile KPI).
 *
 * Regole:
 *  - dallo Sheet arrivano i tipi che hanno un campo corrispondente: Lead → lead ricevuti, Appuntamento → appuntamenti, Vendita → vendite.
 *    I preventivi non hanno ancora un campo tra i dati reali: restano nello Sheet e nella pagina KPI concessionario;
 *  - un valore scritto a mano ha SEMPRE la precedenza (è una correzione dello staff); se lo si toglie, torna quello dello Sheet;
 *  - un tipo che nello Sheet non compare per quel mese resta «dato mancante»: non diventa zero.
 */
import type { MonthTotals } from './types';

export const SHEET_TO_MANUAL = { lead: 'leads_real', appuntamento: 'appointments', vendita: 'sales' } as const;

export type ManualMonthValues = Record<string, number>;

/** I valori dello Sheet per un mese, con i nomi dei campi dei dati reali. Solo i tipi presenti nello Sheet. */
export function sheetToManual(totals: MonthTotals | null | undefined, presentTypes?: ReadonlySet<string>): ManualMonthValues {
    if (!totals) return {};
    const out: ManualMonthValues = {};
    for (const [type, field] of Object.entries(SHEET_TO_MANUAL)) {
        // Il totale di un tipo mai scritto è 0, ma «0 perché assente» non è «0 inserito»: si usa solo ciò che c'è davvero nello Sheet.
        if (presentTypes && !presentTypes.has(type)) continue;
        out[field] = totals.byType[type as keyof typeof totals.byType] ?? 0;
    }
    return out;
}

export interface Merged { values: ManualMonthValues; fromSheet: Record<string, boolean> }

export function mergeManualWithSheet(manual: ManualMonthValues | undefined, sheet: ManualMonthValues | undefined): Merged {
    const values: ManualMonthValues = { ...(sheet ?? {}) };
    const fromSheet: Record<string, boolean> = {};
    for (const k of Object.keys(values)) fromSheet[k] = true;
    for (const [k, v] of Object.entries(manual ?? {})) {
        values[k] = v;
        delete fromSheet[k];
    }
    return { values, fromSheet };
}

/** I tipi davvero presenti nelle voci di un mese (per non trasformare un tipo assente in zero). */
export function typesPresent(entries: Array<{ type: string }> | undefined): Set<string> {
    return new Set((entries ?? []).map((e) => e.type));
}
