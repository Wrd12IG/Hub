/**
 * lib/dealer-kpi/parse.ts
 *
 * Dalle righe grezze dello Sheet (come le restituisce l'API: array di array di testo) ai dati normalizzati, con un elenco di problemi
 * chiaro e per riga. Pura: niente rete.
 *
 * Regole:
 *  - colonne riconosciute dall'intestazione (Mese · Tipo · Marca · Provenienza · Quantità), in qualunque ordine;
 *  - tipo non riconosciuto → errore e riga saltata (non si può indovinare); provenienza non riconosciuta → avviso, contata come «Altro»
 *    (così i totali restano giusti e il problema si vede); quantità non valida → errore e riga saltata;
 *  - righe uguali per mese/tipo/marca/provenienza si sommano; righe vuote si ignorano;
 *  - un mese non compilato NON è zero: semplicemente non compare.
 */
import { ENTRY_TYPES, SOURCES, UNKNOWN_BRAND, type DealerEntry, type EntryType, type ParsedSheet, type SheetIssue, type Source } from './types';

const fold = (s: string) => (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

const COLS = {
    month: ['mese', 'data', 'periodo', 'mese di riferimento'],
    type: ['tipo', 'tipologia', 'voce', 'kpi'],
    brand: ['marca', 'brand'],
    source: ['provenienza', 'origine', 'fonte', 'canale'],
    count: ['quantita', 'numero', 'totale', 'n', 'qta'],
} as const;
type Col = keyof typeof COLS;

const TYPE_ALIASES: Record<string, EntryType> = {
    lead: 'lead', leads: 'lead', 'lead ricevuti': 'lead', contatti: 'lead', contatto: 'lead', richieste: 'lead',
    appuntamento: 'appuntamento', appuntamenti: 'appuntamento',
    preventivo: 'preventivo', preventivi: 'preventivo',
    vendita: 'vendita', vendite: 'vendita', venduto: 'vendita', immatricolazioni: 'vendita', contratti: 'vendita',
};

const SOURCE_ALIASES: Record<string, Source> = {
    google: 'Google', 'google ads': 'Google', adwords: 'Google', 'google my business': 'Google', 'google maps': 'Google', gbp: 'Google',
    meta: 'Meta', facebook: 'Meta', instagram: 'Meta', 'meta ads': 'Meta', 'facebook ads': 'Meta', fb: 'Meta',
    sito: 'Sito', 'sito web': 'Sito', web: 'Sito', organico: 'Sito', form: 'Sito',
    telefono: 'Telefono', telefonata: 'Telefono', chiamata: 'Telefono', telefonate: 'Telefono', chiamate: 'Telefono',
    showroom: 'Showroom', passaggio: 'Showroom', 'in sede': 'Showroom', salone: 'Showroom',
    altro: 'Altro', altri: 'Altro',
};

const MONTHS_IT: Record<string, number> = {
    gennaio: 1, gen: 1, febbraio: 2, feb: 2, marzo: 3, mar: 3, aprile: 4, apr: 4, maggio: 5, mag: 5, giugno: 6, giu: 6,
    luglio: 7, lug: 7, agosto: 8, ago: 8, settembre: 9, set: 9, sett: 9, ottobre: 10, ott: 10, novembre: 11, nov: 11, dicembre: 12, dic: 12,
};

const mk = (y: number, m: number) => (m >= 1 && m <= 12 && y >= 2000 && y <= 2100 ? `${y}-${String(m).padStart(2, '0')}` : null);

/** «2026-11», «2026-11-20», «20/11/2026», «11/2026», «novembre 2026» → «2026-11». Altro → null. */
export function normalizeMonth(raw: string): string | null {
    const s = (raw || '').trim();
    let m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(s);
    if (m) return mk(Number(m[1]), Number(m[2]));
    m = /^\d{1,2}[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
    if (m) return mk(Number(m[2]), Number(m[1]));
    m = /^(\d{1,2})[/.-](\d{4})$/.exec(s);
    if (m) return mk(Number(m[2]), Number(m[1]));
    m = /^([a-zA-Zàèéìòù]+)\.?\s+(\d{4})$/.exec(s);
    if (m) { const n = MONTHS_IT[fold(m[1])]; return n ? mk(Number(m[2]), n) : null; }
    return null;
}

export function normalizeType(raw: string): EntryType | null {
    const t = TYPE_ALIASES[fold(raw)];
    return t && (ENTRY_TYPES as readonly string[]).includes(t) ? t : null;
}

export function normalizeSource(raw: string): Source | null {
    const s = SOURCE_ALIASES[fold(raw)];
    return s && (SOURCES as readonly string[]).includes(s) ? s : null;
}

/** Intero ≥ 0, anche con punti delle migliaia («1.200») o «12,0». Altro → null. */
export function normalizeCount(raw: string): number | null {
    const s = (raw || '').trim().replace(/\s/g, '');
    if (!s) return null;
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''));
    if (/^\d+([.,]0+)?$/.test(s)) return Number(s.replace(/[.,]0+$/, ''));
    return null;
}

const MAX_COUNT = 1_000_000;

function findColumns(header: string[]): { cols: Partial<Record<Col, number>>; missing: Col[] } {
    const cols: Partial<Record<Col, number>> = {};
    header.forEach((h, i) => {
        const f = fold(h);
        (Object.keys(COLS) as Col[]).forEach((c) => { if (cols[c] === undefined && (COLS[c] as readonly string[]).includes(f)) cols[c] = i; });
    });
    const required: Col[] = ['month', 'type', 'source', 'count'];
    return { cols, missing: required.filter((c) => cols[c] === undefined) };
}

const COL_LABEL: Record<Col, string> = { month: 'Mese', type: 'Tipo', brand: 'Marca', source: 'Provenienza', count: 'Quantità' };

export function parseDealerSheet(values: string[][]): ParsedSheet {
    const issues: SheetIssue[] = [];
    if (!values || values.length === 0) return { entries: [], issues: [{ row: 1, level: 'errore', message: 'Lo Sheet è vuoto.' }], rowsRead: 0 };
    const { cols, missing } = findColumns(values[0].map((c) => String(c ?? '')));
    if (missing.length > 0) {
        return { entries: [], issues: [{ row: 1, level: 'errore', message: `Nella prima riga mancano le colonne: ${missing.map((c) => COL_LABEL[c]).join(', ')}.` }], rowsRead: 0 };
    }
    const get = (row: string[], c: Col) => (cols[c] === undefined ? '' : String(row[cols[c] as number] ?? '').trim());

    const sum = new Map<string, DealerEntry>();
    const brandCanon = new Map<string, string>();
    let rowsRead = 0;
    for (let i = 1; i < values.length; i++) {
        const row = values[i] || [];
        const n = i + 1;
        if (row.every((c) => String(c ?? '').trim() === '')) continue;
        rowsRead++;
        const monthRaw = get(row, 'month'), typeRaw = get(row, 'type'), srcRaw = get(row, 'source'), countRaw = get(row, 'count');
        const month = normalizeMonth(monthRaw);
        if (!month) { issues.push({ row: n, level: 'errore', message: `Mese «${monthRaw}» non riconosciuto (usa per esempio 2026-11 oppure 11/2026).` }); continue; }
        const type = normalizeType(typeRaw);
        if (!type) { issues.push({ row: n, level: 'errore', message: `Tipo «${typeRaw}» non riconosciuto (Lead, Appuntamento, Preventivo, Vendita).` }); continue; }
        const count = normalizeCount(countRaw);
        if (count === null || count > MAX_COUNT) { issues.push({ row: n, level: 'errore', message: `Quantità «${countRaw}» non valida: serve un numero intero (0 o più).` }); continue; }

        let source = normalizeSource(srcRaw);
        if (!source) {
            issues.push({ row: n, level: 'avviso', message: srcRaw ? `Provenienza «${srcRaw}» non riconosciuta: contata come Altro.` : 'Provenienza vuota: contata come Altro.' });
            source = 'Altro';
        }
        const brandRaw = get(row, 'brand').replace(/\s+/g, ' ');
        // La stessa marca scritta in modi diversi («fiat», «FIAT ») conta una volta sola: vale la prima scrittura vista.
        const brandKey = fold(brandRaw);
        const brand = brandRaw ? (brandCanon.get(brandKey) ?? (brandCanon.set(brandKey, brandRaw), brandRaw)) : UNKNOWN_BRAND;

        const key = `${month}|${type}|${brand}|${source}`;
        const cur = sum.get(key);
        if (cur) cur.count += count; else sum.set(key, { month, type, brand, source, count });
    }
    return { entries: Array.from(sum.values()).sort((a, b) => a.month.localeCompare(b.month) || a.type.localeCompare(b.type) || a.brand.localeCompare(b.brand) || a.source.localeCompare(b.source)), issues, rowsRead };
}
