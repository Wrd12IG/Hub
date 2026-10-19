// Logica delle tabelle dati (cerca, ordina, esporta, impagina): pura, senza React, così si prova con i test.

export interface TableColumn<T = any> {
    key: string;
    label: string;
    sortable?: boolean;
    isPrimary?: boolean;
    render?: (row: T) => React.ReactNode;
    /** Valore da esportare in CSV, se diverso da row[key] (es. le colonne con elementi grafici). */
    csv?: (row: T) => string | number | null | undefined;
}

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

/** Righe in cui almeno una colonna contiene il testo cercato (senza maiuscole e accenti). */
export function filterRows<T extends Record<string, any>>(rows: T[], columns: TableColumn<T>[], query: string): T[] {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const q = norm(query.trim());
    if (!q) return rows;
    return rows.filter((r) => columns.some((c) => norm(text(c.csv ? c.csv(r) : r[c.key])).includes(q)));
}

/** Ordina per colonna: i numeri come numeri, il resto come testo italiano; i valori vuoti vanno sempre in fondo. */
export function sortRows<T extends Record<string, any>>(rows: T[], key: string | null, dir: 'asc' | 'desc'): T[] {
    if (!key) return rows;
    const sign = dir === 'asc' ? 1 : -1;
    const empty = (v: unknown) => v === null || v === undefined || v === '';
    return [...rows].sort((a, b) => {
        const x = a[key];
        const y = b[key];
        if (empty(x) && empty(y)) return 0;
        if (empty(x)) return 1;
        if (empty(y)) return -1;
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * sign;
        return text(x).localeCompare(text(y), 'it', { numeric: true, sensitivity: 'base' }) * sign;
    });
}

const csvCell = (v: string | number | null | undefined): string => {
    const s = text(v);
    // Le celle che iniziano con = + - @ vengono eseguite come formule da Excel: si neutralizzano con un apice
    const safe = /^[=+@]/.test(s) || (/^-/.test(s) && Number.isNaN(Number(s))) ? `'${s}` : s;
    return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV con punto e virgola (l'Excel italiano lo vuole) e BOM iniziale per gli accenti. Solo le colonne con un valore esportabile. */
export function toCsv<T extends Record<string, any>>(rows: T[], columns: TableColumn<T>[]): string {
    const cols = columns.filter((c) => c.csv || rows.some((r) => r[c.key] !== undefined));
    const head = cols.map((c) => csvCell(c.label)).join(';');
    const body = rows.map((r) => cols.map((c) => csvCell(c.csv ? c.csv(r) : r[c.key])).join(';'));
    return '﻿' + [head, ...body].join('\r\n');
}

export function paginate<T>(rows: T[], page: number, size: number) {
    const pages = Math.max(1, Math.ceil(rows.length / size));
    const current = Math.min(Math.max(1, page), pages);
    const from = (current - 1) * size;
    return { items: rows.slice(from, from + size), page: current, pages, from: rows.length === 0 ? 0 : from + 1, to: Math.min(from + size, rows.length) };
}
