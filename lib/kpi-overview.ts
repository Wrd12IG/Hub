/**
 * lib/kpi-overview.ts
 *
 * La panoramica «KPI per profilo»: tutti i clienti di un profilo (auto, e-commerce, locale, B2B, social) affiancati per
 * un mese, con i KPI di quel profilo. È ciò che la pagina dei concessionari fa con i dati degli Sheet, ma per ogni profilo
 * e con i numeri già calcolati (le «fotografie» mensili di lib/monthly-mail-store.ts): nessuna chiamata a Meta, Google o
 * Analytics, quindi è immediata. Pura (nessun I/O).
 *
 * Un cliente senza fotografia per quel mese compare lo stesso, segnato «da calcolare»: non si fa passare per zero.
 */
import { formatDelta, formatValue, type ClientMonthly, type KpiResult } from './kpi-compute';
import { PROFILE_DEFS, type KpiProfile, type KpiUnit } from './kpi-profiles';

/** `inMail`: il cliente entra nella mail mensile. Solo per quelli si calcolano i numeri da Andamento clienti. */
export interface OverviewClient { id: string; name: string; inMail?: boolean }
export type SnapshotMap = Record<string, { computedAt: string; result: ClientMonthly } | undefined>;

export interface OverviewColumn { id: string; label: string; unit: KpiUnit }

export interface OverviewRow {
    clientId: string;
    name: string;
    hasSnapshot: boolean;
    /** Nella mail mensile? `null` se non si sa. */
    inMail: boolean | null;
    computedAt: string | null;
    /** Mese in corso: i numeri sono dei primi N giorni. */
    partialDays: number | null;
    cells: Record<string, KpiResult | undefined>;
}

export interface ProfileOverview {
    profile: KpiProfile;
    month: string;
    columns: OverviewColumn[];
    rows: OverviewRow[];
    /** Clienti con la fotografia del mese. */
    withData: number;
    total: number;
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' });

export function buildProfileOverview(input: { profile: KpiProfile; month: string; clients: OverviewClient[]; snapshots: SnapshotMap }): ProfileOverview {
    const { profile, month, snapshots } = input;

    const seen = new Map<string, OverviewColumn>();
    for (const c of input.clients) {
        for (const k of snapshots[c.id]?.result.kpis ?? []) if (!seen.has(k.id)) seen.set(k.id, { id: k.id, label: k.label, unit: k.unit });
    }
    // Prima i KPI che il profilo considera importanti, nel loro ordine; poi gli altri (scelti a mano per qualche cliente)
    const defaults = PROFILE_DEFS[profile].defaultKpis.filter((id) => seen.has(id));
    const columns = [...defaults, ...Array.from(seen.keys()).filter((id) => !defaults.includes(id))].map((id) => seen.get(id)!) ;

    const rows: OverviewRow[] = input.clients.slice().sort(byName).map((c) => {
        const snap = snapshots[c.id];
        const cells: Record<string, KpiResult | undefined> = {};
        for (const k of snap?.result.kpis ?? []) cells[k.id] = k;
        return {
            clientId: c.id,
            name: c.name,
            hasSnapshot: !!snap,
            inMail: c.inMail ?? null,
            computedAt: snap?.computedAt ?? null,
            partialDays: snap?.result.partial?.days ?? null,
            cells,
        };
    });

    return { profile, month, columns, rows, withData: rows.filter((r) => r.hasSnapshot).length, total: rows.length };
}

/** Come si scrive un valore nella tabella: il numero, «~» davanti se è una stima di piattaforma, «—» se manca. */
export function cellText(k: KpiResult | undefined): string {
    if (!k || k.value === null) return '—';
    return `${k.kind === 'proxy' ? '~' : ''}${formatValue(k.value, k.unit)}`;
}

/** La variazione sul mese prima, o «—». */
export function deltaText(k: KpiResult | undefined): string {
    return k ? formatDelta(k.vsPrev, k.unit) : '—';
}

type Cell = string | number | null;

const cell = (v: Cell): string => {
    if (v === null) return '';
    // Un testo che inizia con = + - @ verrebbe letto da Excel come formula: lo si neutralizza.
    // Fanno eccezione i numeri col segno («+5%», «−12,3»): sono variazioni, non formule.
    const isSignedNumber = typeof v === 'string' && /^[+\-−]\d[\d.,]*\s?%?$/.test(v);
    const s = typeof v === 'string' && !isSignedNumber && /^[=+\-@\t\r]/.test(v) ? `'${v}` : String(v);
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const line = (cells: Cell[]): string => cells.map(cell).join(';');

/** CSV pronto per Excel italiano (separatore «;»): per ogni KPI due colonne, il valore e la variazione sul mese prima. */
export function overviewToCsv(o: ProfileOverview): string {
    const out: string[] = [];
    out.push(line(['Mese', 'Profilo', 'Cliente', ...o.columns.flatMap((c) => [c.label, `${c.label} (var. mese prima)`])]));
    for (const r of o.rows) {
        out.push(line([
            o.month, PROFILE_DEFS[o.profile].label, r.name,
            ...o.columns.flatMap((c): Cell[] => (r.hasSnapshot ? [cellText(r.cells[c.id]), deltaText(r.cells[c.id])] : [r.inMail === false ? 'non nella mail mensile' : 'da calcolare', ''])),
        ]));
    }
    return out.join('\r\n') + '\r\n';
}
