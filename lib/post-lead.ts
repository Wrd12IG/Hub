// Dopo il lead: appuntamenti, prove e vendite caricati da un file (esportazione del CRM o del gestionale). Del file si
// conservano SOLO i conteggi per mese, fase e canale: nomi, telefoni e email dei clienti non vengono mai salvati.

export type Stage = 'lead' | 'appuntamento' | 'prova' | 'vendita';
export const STAGES: Stage[] = ['lead', 'appuntamento', 'prova', 'vendita'];
export const STAGE_LABEL: Record<Stage, string> = { lead: 'Lead', appuntamento: 'Appuntamenti', prova: 'Prove', vendita: 'Vendite' };

export interface PostLeadEntry { month: string; stage: Stage; channel: string; count: number }
export interface PostLeadData { entries: PostLeadEntry[]; updatedAt?: string; fileName?: string }

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

export function parseStage(v: unknown): Stage | null {
    const s = norm(v);
    if (!s) return null;
    if (/(vendit|vendut|contratt|ordin|immatricol|consegn)/.test(s)) return 'vendita';
    if (/(prova|test\s*drive|testdrive|guida)/.test(s)) return 'prova';
    if (/(appuntament|visita|showroom)/.test(s)) return 'appuntamento';
    if (/(lead|contatt|richiest|preventiv)/.test(s)) return 'lead';
    return null;
}

/** Data da cella Excel (numero seriale o Date) o da testo gg/mm/aaaa, gg-mm-aaaa, aaaa-mm-gg → "aaaa-mm". */
export function parseMonth(v: unknown): string | null {
    let y: number, m: number;
    if (v instanceof Date && !isNaN(v.getTime())) { y = v.getUTCFullYear(); m = v.getUTCMonth() + 1; }
    else if (typeof v === 'number' && v > 20000 && v < 80000) {
        const d = new Date(Math.round((v - 25569) * 86400 * 1000));
        y = d.getUTCFullYear(); m = d.getUTCMonth() + 1;
    } else {
        const s = String(v ?? '').trim();
        let mt = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?/);
        if (mt) { y = +mt[1]; m = +mt[2]; }
        else if ((mt = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) { m = +mt[2]; y = +mt[3] < 100 ? 2000 + +mt[3] : +mt[3]; }
        else return null;
    }
    if (m < 1 || m > 12 || y < 2000 || y > 2100) return null;
    return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Righe del foglio (array di array, come le dà xlsx). Colonne riconosciute dall'intestazione:
 * data, fase (o tipo/stato/evento), canale (o fonte/origine, facoltativa), quantità (facoltativa, di default 1).
 * Ogni riga conta come un evento; le righe già riassunte hanno la colonna quantità.
 */
export function parsePostLeadRows(rows: unknown[][]): { entries: PostLeadEntry[]; read: number; skipped: number } {
    const idx = rows.findIndex((r) => r.some((c) => /^data/.test(norm(c))) && r.some((c) => /^(fase|tipo|stato|evento|esito)/.test(norm(c))));
    if (idx < 0) return { entries: [], read: 0, skipped: 0 };
    const head = rows[idx].map(norm);
    const find = (re: RegExp) => head.findIndex((h) => re.test(h));
    const cDate = find(/^data/), cStage = find(/^(fase|tipo|stato|evento|esito)/), cChan = find(/^(canale|fonte|origine|sorgente)/), cQty = find(/^(quantit|n\.?$|numero|conteggio|totale)/);
    const acc = new Map<string, PostLeadEntry>();
    let read = 0, skipped = 0;
    for (const r of rows.slice(idx + 1)) {
        if (!r.some((c) => c !== undefined && c !== null && c !== '')) continue;
        const month = parseMonth(r[cDate]);
        const stage = parseStage(r[cStage]);
        const q = cQty >= 0 ? Number(String(r[cQty] ?? '').replace(',', '.')) : 1;
        if (!month || !stage || !Number.isFinite(q) || q <= 0) { skipped++; continue; }
        const channel = cChan >= 0 && String(r[cChan] ?? '').trim() ? String(r[cChan]).trim() : 'Non indicato';
        const key = `${month}|${stage}|${channel.toLowerCase()}`;
        const cur = acc.get(key);
        if (cur) cur.count += q; else acc.set(key, { month, stage, channel, count: q });
        read += q;
    }
    return { entries: Array.from(acc.values()), read, skipped };
}

/** Il nuovo file sostituisce i mesi che contiene (ricaricare un mese corregge i numeri, non li raddoppia). */
export function mergeEntries(existing: PostLeadEntry[], incoming: PostLeadEntry[]): PostLeadEntry[] {
    const months = new Set(incoming.map((e) => e.month));
    return existing.filter((e) => !months.has(e.month)).concat(incoming).sort((a, b) => a.month.localeCompare(b.month) || STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage));
}

export interface FunnelMonth { month: string; counts: Record<Stage, number> }

export function funnelByMonth(entries: PostLeadEntry[]): FunnelMonth[] {
    const map = new Map<string, FunnelMonth>();
    for (const e of entries) {
        const f = map.get(e.month) ?? { month: e.month, counts: { lead: 0, appuntamento: 0, prova: 0, vendita: 0 } };
        f.counts[e.stage] += e.count;
        map.set(e.month, f);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

/** Percentuale intera di `part` su `whole`, null se non c'è base. */
export const rate = (part: number, whole: number): number | null => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

/** Totali per canale (ultime righe del dettaglio): dove nascono davvero appuntamenti e vendite. */
export function byChannel(entries: PostLeadEntry[]): { channel: string; counts: Record<Stage, number> }[] {
    const map = new Map<string, { channel: string; counts: Record<Stage, number> }>();
    for (const e of entries) {
        const k = e.channel.toLowerCase();
        const c = map.get(k) ?? { channel: e.channel, counts: { lead: 0, appuntamento: 0, prova: 0, vendita: 0 } };
        c.counts[e.stage] += e.count;
        map.set(k, c);
    }
    return Array.from(map.values()).sort((a, b) => b.counts.vendita - a.counts.vendita || b.counts.lead - a.counts.lead);
}

export const TEMPLATE_CSV = 'Data;Fase;Canale;Quantità\n15/10/2026;Lead;Meta;1\n16/10/2026;Appuntamento;Meta;1\n20/10/2026;Prova;Google;1\n28/10/2026;Vendita;Meta;1\n';
