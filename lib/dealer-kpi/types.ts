/**
 * lib/dealer-kpi/types.ts
 *
 * I dati dei concessionari che il cliente compila in uno Sheet Google: lead, appuntamenti, preventivi e vendite, per marca e provenienza.
 */
export const ENTRY_TYPES = ['lead', 'appuntamento', 'preventivo', 'vendita'] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];
export const TYPE_LABEL: Record<EntryType, string> = { lead: 'Lead', appuntamento: 'Appuntamento', preventivo: 'Preventivo', vendita: 'Vendita' };

/** L'elenco fisso (è anche la tendina dello Sheet): con testo libero i totali per provenienza non tornerebbero. */
export const SOURCES = ['Google', 'Meta', 'Sito', 'Telefono', 'Showroom', 'Altro'] as const;
export type Source = (typeof SOURCES)[number];

export const UNKNOWN_BRAND = 'Non indicata';

export interface DealerEntry { month: string; type: EntryType; brand: string; source: Source; count: number }

export type IssueLevel = 'errore' | 'avviso';
/** Un problema nello Sheet, con la riga (come la vede chi apre il foglio, intestazione = riga 1). */
export interface SheetIssue { row: number; level: IssueLevel; message: string }

export interface ParsedSheet { entries: DealerEntry[]; issues: SheetIssue[]; rowsRead: number }

export interface MonthTotals {
    month: string;
    byType: Record<EntryType, number>;
    /** type → marca → totale */
    byBrand: Record<EntryType, Record<string, number>>;
    /** type → provenienza → totale */
    bySource: Record<EntryType, Record<string, number>>;
}
