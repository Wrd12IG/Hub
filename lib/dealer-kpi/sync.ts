/**
 * lib/dealer-kpi/sync.ts
 *
 * Sincronizza lo Sheet di un cliente: legge, normalizza, salva i dati per mese e lo stato della sincronizzazione.
 * Archivio e lettore sono iniettati (nei test: finti). Se la lettura fallisce o lo Sheet è strutturalmente sbagliato NON si tocca
 * ciò che era già salvato: un errore momentaneo non deve cancellare lo storico.
 */
import { parseDealerSheet } from './parse';
import { SheetsError, type SheetsReader } from './sheets';
import { totalsByMonth } from './totals';
import type { DealerEntry, MonthTotals, SheetIssue } from './types';

export interface SheetConfig { spreadsheetId: string; tab: string }

export interface SyncStatus {
    lastSyncAt: string;
    lastStatus: 'ok' | 'avvisi' | 'errore';
    lastMessage: string;
    rowsRead: number;
    months: string[];
    /** Primi problemi trovati, per mostrarli all'utente. */
    issues: SheetIssue[];
    issuesTotal: number;
}

export interface MonthDoc { month: string; entries: Array<Pick<DealerEntry, 'type' | 'brand' | 'source' | 'count'>>; totals: MonthTotals; syncedAt: string }

export interface DealerStore {
    getConfig(clientId: string): Promise<(SheetConfig & { status?: SyncStatus }) | null>;
    saveStatus(clientId: string, status: SyncStatus): Promise<void>;
    /** Scrive i mesi dati e cancella quelli che nello Sheet non ci sono più. */
    replaceMonths(clientId: string, months: MonthDoc[]): Promise<void>;
}

export const MAX_ISSUES_STORED = 50;

export async function syncClient(clientId: string, deps: { store: DealerStore; reader: SheetsReader; now: Date }): Promise<SyncStatus> {
    const { store, reader, now } = deps;
    const at = now.toISOString();
    const config = await store.getConfig(clientId);
    const fail = async (message: string): Promise<SyncStatus> => {
        const prev = config?.status;
        const s: SyncStatus = { lastSyncAt: at, lastStatus: 'errore', lastMessage: message, rowsRead: prev?.rowsRead ?? 0, months: prev?.months ?? [], issues: [], issuesTotal: 0 };
        if (config) await store.saveStatus(clientId, s);
        return s;
    };
    if (!config) return fail('Nessuno Sheet collegato a questo cliente.');

    let values: string[][];
    try {
        values = await reader(config.spreadsheetId, config.tab);
    } catch (e) {
        return fail(e instanceof SheetsError ? e.message : `Errore nella lettura dello Sheet: ${e instanceof Error ? e.message : 'sconosciuto'}`);
    }

    const parsed = parseDealerSheet(values);
    // Struttura sbagliata (vuoto, colonne mancanti): nessun dato letto e un errore a livello di intestazione → si conserva ciò che c'era.
    if (parsed.entries.length === 0 && parsed.issues.some((i) => i.row === 1 && i.level === 'errore')) return fail(parsed.issues[0].message);

    const totals = totalsByMonth(parsed.entries);
    const docs: MonthDoc[] = totals.map((t) => ({
        month: t.month, totals: t, syncedAt: at,
        entries: parsed.entries.filter((e) => e.month === t.month).map(({ type, brand, source, count }) => ({ type, brand, source, count })),
    }));
    await store.replaceMonths(clientId, docs);

    const errors = parsed.issues.filter((i) => i.level === 'errore').length;
    const status: SyncStatus = {
        lastSyncAt: at,
        lastStatus: parsed.issues.length === 0 ? 'ok' : 'avvisi',
        lastMessage: parsed.issues.length === 0
            ? `${parsed.entries.length} voci in ${totals.length} ${totals.length === 1 ? 'mese' : 'mesi'}.`
            : `${parsed.entries.length} voci in ${totals.length} ${totals.length === 1 ? 'mese' : 'mesi'}; ${errors} ${errors === 1 ? 'riga saltata' : 'righe saltate'}, ${parsed.issues.length - errors} avvisi.`,
        rowsRead: parsed.rowsRead,
        months: totals.map((t) => t.month),
        issues: parsed.issues.slice(0, MAX_ISSUES_STORED),
        issuesTotal: parsed.issues.length,
    };
    await store.saveStatus(clientId, status);
    return status;
}

export function memoryDealerStore(config: (SheetConfig & { status?: SyncStatus }) | null): DealerStore & { months: Map<string, MonthDoc>; status: () => SyncStatus | undefined } {
    const months = new Map<string, MonthDoc>();
    let cfg = config;
    return {
        months,
        status: () => cfg?.status,
        async getConfig() { return cfg; },
        async saveStatus(_c, status) { if (cfg) cfg = { ...cfg, status }; },
        async replaceMonths(_c, docs) { months.clear(); for (const d of docs) months.set(d.month, d); },
    };
}
