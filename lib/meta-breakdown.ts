// Viste di dettaglio Meta Ads (per annuncio, per età e genere, per zona): somma le righe che Windsor restituisce
// e ricalcola le metriche dai totali, con la stessa logica di conversione della route delle campagne.
import { ratio } from './meta-metrics';

/**
 * Gli acquisti, in ordine di affidabilità. Se l'account ne registra, la conversione è quella: è l'unica legata al fatturato.
 */
export const PURCHASE_FIELDS = [
    'actions_omni_purchase',
    'actions_offsite_conversion_fb_pixel_purchase',
    'actions_purchase',
] as const;

/** Le altre azioni possibili: senza acquisti si prende quella con più volume, non la prima di una classifica teorica. */
export const OTHER_ACTION_FIELDS = [
    'actions_lead',
    'actions_complete_registration',
    'actions_initiate_checkout',
    'actions_add_to_cart',
] as const;

export const ACTION_FIELDS = [...PURCHASE_FIELDS, ...OTHER_ACTION_FIELDS] as const;

export const ACTION_LABELS: Record<string, string> = {
    actions_omni_purchase: 'Acquisti',
    actions_offsite_conversion_fb_pixel_purchase: 'Acquisti (pixel)',
    actions_purchase: 'Acquisti',
    actions_lead: 'Lead',
    actions_complete_registration: 'Registrazioni',
    actions_initiate_checkout: 'Checkout avviati',
    actions_add_to_cart: 'Aggiunte al carrello',
};

/**
 * Con la scomposizione per zona Windsor restituisce `actions_lead` = 0 anche quando i lead ci sono (verificato su City Motors:
 * 0 contro 51), mentre questo campo li riporta. Sono la stessa metrica: per ogni riga vale il valore più alto dei due.
 */
export const LEAD_ALIAS_FIELD = 'actions_onsite_conversion_lead_grouped';

type Row = Record<string, string | number | null | undefined>;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const round = (n: number) => Math.round(n * 100) / 100;

/** Valore di un'azione in una riga; per i lead tiene conto dell'alias. */
export function actionValue(row: Row, field: string): number {
    return field === 'actions_lead' ? Math.max(num(row.actions_lead), num(row[LEAD_ALIAS_FIELD])) : num(row[field]);
}

/** Su quale azione contare le conversioni: acquisti se ce ne sono, altrimenti l'azione più numerosa. */
export function pickConversionBasis(rows: Row[]): string | null {
    const total = (f: string) => rows.reduce((s, r) => s + actionValue(r, f), 0);
    return (
        PURCHASE_FIELDS.find((f) => total(f) > 0) ??
        [...OTHER_ACTION_FIELDS].filter((f) => total(f) > 0).sort((a, b) => total(b) - total(a))[0] ??
        null
    );
}

export interface BreakdownRow {
    key: string;
    label: string;
    /** Seconda etichetta (campagna per gli annunci, genere per l'età) */
    detail?: string;
    spend: number;
    impressions: number;
    clicks: number;
    reach: number;
    ctr: number | null;
    cpc: number | null;
    frequency: number | null;
    conversions: number;
    costPerConversion: number | null;
}

interface Dimension {
    key: (row: Row) => string;
    label: (row: Row) => string;
    detail?: (row: Row) => string | undefined;
}

/** Raggruppa le righe per dimensione, somma e ricalcola CTR, CPC, frequenza e costo per conversione dai totali. */
export function aggregateBreakdown(rows: Row[], dim: Dimension, basis: string | null): BreakdownRow[] {
    const groups = new Map<string, { key: string; label: string; detail?: string; spend: number; impressions: number; clicks: number; reach: number; conversions: number }>();
    for (const r of rows) {
        const key = dim.key(r);
        const g = groups.get(key) ?? { key, label: dim.label(r), detail: dim.detail?.(r), spend: 0, impressions: 0, clicks: 0, reach: 0, conversions: 0 };
        g.spend += num(r.spend);
        g.impressions += num(r.impressions);
        g.clicks += num(r.clicks);
        g.reach += num(r.reach);
        g.conversions += basis ? actionValue(r, basis) : 0;
        groups.set(key, g);
    }
    return Array.from(groups.values()).map((g) => ({
        key: g.key,
        label: g.label,
        ...(g.detail !== undefined ? { detail: g.detail } : {}),
        spend: round(g.spend),
        impressions: g.impressions,
        clicks: g.clicks,
        reach: g.reach,
        ctr: ratio(g.clicks, g.impressions, 100) ?? null,
        cpc: ratio(g.spend, g.clicks) ?? null,
        // Reach e frequenza hanno senso solo per riga già aggregata sull'intero periodo (l'unica che chiediamo)
        frequency: ratio(g.impressions, g.reach) ?? null,
        conversions: round(g.conversions),
        costPerConversion: ratio(g.spend, g.conversions) ?? null,
    }));
}

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function byAd(rows: Row[], basis: string | null): BreakdownRow[] {
    return aggregateBreakdown(
        rows.filter((r) => str(r.ad_id) || str(r.ad_name)),
        {
            key: (r) => str(r.ad_id) || str(r.ad_name),
            label: (r) => str(r.ad_name) || str(r.ad_id),
            detail: (r) => str(r.campaign) || undefined,
        },
        basis,
    ).sort((a, b) => b.spend - a.spend);
}

export const GENDER_LABELS: Record<string, string> = { female: 'Donne', male: 'Uomini', unknown: 'Non specificato' };
const GENDER_ORDER = ['female', 'male', 'unknown'];

/** Una riga per fascia d'età e genere, in ordine di età (18-24, 25-34, …, 65+) e poi di genere. */
export function byAgeGender(rows: Row[], basis: string | null): BreakdownRow[] {
    const age = (r: Row) => str(r.age) || 'Non indicata';
    const gender = (r: Row) => str(r.gender) || 'unknown';
    const out = aggregateBreakdown(
        rows,
        {
            key: (r) => `${age(r)}|${gender(r)}`,
            label: age,
            detail: (r) => GENDER_LABELS[gender(r)] ?? gender(r),
        },
        basis,
    );
    const genderRank = (k: string) => {
        const i = GENDER_ORDER.indexOf(k.split('|')[1]);
        return i === -1 ? GENDER_ORDER.length : i;
    };
    return out.sort((a, b) => a.label.localeCompare(b.label, 'it', { numeric: true }) || genderRank(a.key) - genderRank(b.key));
}

/** Una riga per regione, in ordine di spesa. Righe senza regione finiscono in «Non indicata». */
export function byRegion(rows: Row[], basis: string | null): BreakdownRow[] {
    return aggregateBreakdown(
        rows,
        { key: (r) => str(r.region) || 'Non indicata', label: (r) => str(r.region) || 'Non indicata' },
        basis,
    ).sort((a, b) => b.spend - a.spend);
}
