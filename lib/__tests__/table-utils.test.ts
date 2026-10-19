import { describe, it, expect } from 'vitest';
import { filterRows, sortRows, toCsv, paginate, type TableColumn } from '../table-utils';

const cols: TableColumn[] = [
    { key: 'name', label: 'Nome', isPrimary: true },
    { key: 'spend', label: 'Spesa' },
    { key: 'action', label: 'Azioni', render: () => null },
];
const rows = [
    { name: 'Hilux Settembre', spend: 117.92 },
    { name: 'Proace Max', spend: 336.11 },
    { name: 'Più offerte', spend: 9.99 },
    { name: 'Senza spesa', spend: null },
];

describe('table-utils', () => {
    it('cerca senza maiuscole né accenti', () => {
        expect(filterRows(rows, cols, 'piu').map((r) => r.name)).toEqual(['Più offerte']);
        expect(filterRows(rows, cols, '  ')).toHaveLength(4);
        expect(filterRows(rows, cols, 'zzz')).toHaveLength(0);
    });

    it('ordina i numeri come numeri e i vuoti in fondo in entrambe le direzioni', () => {
        expect(sortRows(rows, 'spend', 'asc').map((r) => r.spend)).toEqual([9.99, 117.92, 336.11, null]);
        expect(sortRows(rows, 'spend', 'desc').map((r) => r.spend)).toEqual([336.11, 117.92, 9.99, null]);
        expect(sortRows(rows, 'name', 'asc')[0].name).toBe('Hilux Settembre');
        expect(sortRows(rows, null, 'asc')).toBe(rows);
    });

    it('CSV: punto e virgola, BOM, solo colonne esportabili, citazioni e formule neutralizzate', () => {
        const csv = toCsv([{ name: 'A; "B"', spend: 5 }, { name: '=SOMMA(1;2)', spend: -3 }], cols);
        const lines = csv.replace('﻿', '').split('\r\n');
        expect(csv.startsWith('﻿')).toBe(true);
        expect(lines[0]).toBe('Nome;Spesa');
        expect(lines[1]).toBe('"A; ""B""";5');
        expect(lines[2]).toBe('"\'=SOMMA(1;2)";-3');
    });

    it('impagina e tiene la pagina dentro i limiti', () => {
        const many = Array.from({ length: 23 }, (_, i) => i);
        expect(paginate(many, 1, 10)).toMatchObject({ pages: 3, from: 1, to: 10 });
        expect(paginate(many, 3, 10)).toMatchObject({ from: 21, to: 23, items: [20, 21, 22] });
        expect(paginate(many, 99, 10).page).toBe(3);
        expect(paginate([], 1, 10)).toMatchObject({ pages: 1, from: 0, to: 0 });
    });
});
