/**
 * lib/assignments/parse.ts
 *
 * Legge il foglio delle assegnazioni incollato da Excel (celle copiate = testo separato da tabulazioni; va bene anche CSV con ; o ,).
 * Colonne usate, nell'ordine del foglio: Nome cliente · Direzionale (Sì/No) · Peso · Referente · Backup. Le altre (totali, seconda tabella) si ignorano.
 */
import type { SheetRow } from './model';

function delimiterOf(line: string): string {
    if (line.includes('\t')) return '\t';
    const semi = (line.match(/;/g) || []).length;
    const comma = (line.match(/,/g) || []).length;
    return semi >= comma ? ';' : ',';
}

function splitLine(line: string, d: string): string[] {
    if (d === '\t') return line.split('\t').map((c) => c.trim());
    const out: string[] = [];
    let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted; }
        else if (ch === d && !quoted) { out.push(cur.trim()); cur = ''; }
        else cur += ch;
    }
    out.push(cur.trim());
    return out;
}

const yesNo = (v: string): boolean | null => {
    const s = v.trim().toLowerCase();
    if (['sì', 'si', 'yes', 's', 'true', '1'].includes(s)) return true;
    if (['no', 'n', 'false', '0'].includes(s)) return false;
    return null;
};

export interface ParseResult { rows: SheetRow[]; warnings: string[] }

export function parseAssignmentsSheet(text: string): ParseResult {
    const lines = (text || '').split(/\r\n|\n|\r/).filter((l) => l.trim() !== '');
    if (lines.length === 0) return { rows: [], warnings: ['Il foglio è vuoto.'] };
    const d = delimiterOf(lines[0]);
    const warnings: string[] = [];
    const header = splitLine(lines[0], d).map((c) => c.toLowerCase());
    const hasHeader = header.some((c) => c.includes('cliente')) && header.some((c) => c.includes('referente'));
    const body = hasHeader ? lines.slice(1) : lines;
    const rows: SheetRow[] = [];
    body.forEach((line, i) => {
        const c = splitLine(line, d);
        const clientName = (c[0] || '').trim();
        // La riga dei totali («Totale» nella seconda tabella) e le righe senza cliente non sono assegnazioni.
        if (!clientName || /^totale$/i.test(clientName)) return;
        const pesoRaw = (c[2] || '').replace(',', '.').trim();
        const peso = pesoRaw === '' ? null : Number(pesoRaw);
        if (peso !== null && !Number.isFinite(peso)) warnings.push(`Riga ${i + 1} («${clientName}»): il peso «${c[2]}» non è un numero.`);
        const referente = (c[3] || '').trim();
        if (!referente) { warnings.push(`Riga ${i + 1} («${clientName}»): manca il referente.`); return; }
        rows.push({
            row: i + 1, clientName,
            direzionale: yesNo(c[1] || ''),
            peso: peso !== null && Number.isFinite(peso) ? peso : null,
            referente, backup: (c[4] || '').trim(),
        });
    });
    return { rows, warnings };
}
