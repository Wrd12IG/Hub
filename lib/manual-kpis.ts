/**
 * lib/manual-kpis.ts
 *
 * I «dati reali» del mese: ciò che nessuna piattaforma può sapere (lead arrivati davvero, appuntamenti, test drive,
 * vendite). Si inseriscono a mano o da CSV e sostituiscono i proxy di piattaforma (lead Meta) nella mail mensile.
 *
 * Un valore assente NON è zero: «non inserito» e «0 lead» sono cose diverse, e la mail deve poter dire «dato mancante»
 * invece di mostrare uno zero inventato. Per questo `null` toglie il valore e un campo non toccato resta com'è.
 */

import { KPI_PROFILES, PROFILE_DEFS, normalizeName, type KpiProfile } from './kpi-profiles';

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const isMonthKey = (v: unknown): v is string => typeof v === 'string' && MONTH_RE.test(v);

/** Il mese appena chiuso (quello del report mensile) come «AAAA-MM», dal calendario di Roma. */
export function previousMonthKey(now: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit' }).formatToParts(now);
    const y = Number(parts.find((p) => p.type === 'year')!.value);
    const m = Number(parts.find((p) => p.type === 'month')!.value);
    return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

export interface ManualField { id: string; label: string }

/** Tutti i campi manuali possibili, nell'ordine in cui compaiono come colonne: l'unione di quelli dei profili. */
export const MANUAL_FIELDS: ManualField[] = (() => {
    const seen = new Map<string, ManualField>();
    for (const p of KPI_PROFILES) for (const f of PROFILE_DEFS[p].manualFields) if (!seen.has(f.id)) seen.set(f.id, f);
    return Array.from(seen.values());
})();
export const MANUAL_FIELD_IDS = MANUAL_FIELDS.map((f) => f.id);

/** I campi che un profilo può inserire a mano. */
export const fieldsForProfile = (profile: KpiProfile | null | undefined): string[] =>
    profile && PROFILE_DEFS[profile] ? PROFILE_DEFS[profile].manualFields.map((f) => f.id) : [];

export const MAX_MANUAL_VALUE = 1_000_000;

export type ManualValues = Record<string, number | null>;

/** Controlla i valori di un cliente: solo campi noti, ognuno un intero 0…1.000.000 oppure null (toglie il valore). */
export function cleanManualValues(raw: unknown): { ok: true; values: ManualValues } | { ok: false; error: string } {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'Valori non validi.' };
    const values: ManualValues = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (!MANUAL_FIELD_IDS.includes(k)) return { ok: false, error: `Campo sconosciuto: ${k}.` };
        if (v === null) { values[k] = null; continue; }
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX_MANUAL_VALUE) {
            return { ok: false, error: `«${k}»: serve un numero intero tra 0 e ${MAX_MANUAL_VALUE.toLocaleString('it-IT')}.` };
        }
        values[k] = v;
    }
    return { ok: true, values };
}

/* ───────────── CSV ───────────── */

const HEADER_ALIASES: Record<string, string> = {
    cliente: 'name', nome: 'name', client: 'name',
    lead: 'leads_real', leads: 'leads_real', leadricevuti: 'leads_real',
    appuntamenti: 'appointments',
    testdrive: 'test_drives',
    vendite: 'sales', immatricolazioni: 'sales',
    ordini: 'orders',
};

export interface CsvRow { clientId: string; name: string; values: Record<string, number> }
export interface CsvResult { rows: CsvRow[]; unmatched: string[]; unknownColumns: string[]; errors: string[] }

/**
 * Legge un CSV (separatore «;», tab o «,»: Excel italiano esporta con «;») con una riga di intestazione. La colonna del
 * cliente si chiama «Cliente» e le altre «Lead», «Appuntamenti», «Test drive», «Vendite», «Ordini». Una cella vuota NON
 * tocca il valore. I nomi si abbinano ai clienti senza badare a maiuscole, accenti e segni; un nome che non corrisponde
 * finisce in `unmatched` invece di essere ignorato in silenzio.
 */
export function parseManualCsv(text: string, clients: { id: string; name: string }[]): CsvResult {
    const out: CsvResult = { rows: [], unmatched: [], unknownColumns: [], errors: [] };
    const lines = String(text ?? '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 2) { out.errors.push("Il file deve avere un'intestazione e almeno una riga."); return out; }

    const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
    const cells = (line: string) => line.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, '$1').trim());

    const rawHeader = cells(lines[0]);
    const header = rawHeader.map((h) => HEADER_ALIASES[normalizeName(h)] ?? null);
    const nameCol = header.indexOf('name');
    if (nameCol < 0) { out.errors.push('Manca la colonna «Cliente».'); return out; }
    header.forEach((h, i) => { if (!h) out.unknownColumns.push(rawHeader[i]); });

    const byName = new Map(clients.map((c) => [normalizeName(c.name), c]));
    for (let i = 1; i < lines.length; i++) {
        const row = cells(lines[i]);
        const name = row[nameCol] ?? '';
        if (!name) continue;
        const client = byName.get(normalizeName(name));
        if (!client) { out.unmatched.push(name); continue; }
        const values: Record<string, number> = {};
        let bad = false;
        header.forEach((field, col) => {
            if (!field || field === 'name') return;
            const cell = row[col] ?? '';
            if (cell === '') return;
            if (!/^\d+$/.test(cell)) { out.errors.push(`Riga ${i + 1} (${name}): «${cell}» non è un numero intero.`); bad = true; return; }
            values[field] = Number(cell);
        });
        if (!bad && Object.keys(values).length) out.rows.push({ clientId: client.id, name: client.name, values });
    }
    return out;
}
