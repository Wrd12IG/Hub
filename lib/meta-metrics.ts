// Metriche derivate di Meta Ads: tutte ricalcolate dai totali, mai sommate né mediate fra righe.
// Windsor restituisce `ctr` come frazione (0,0196) e `cpc`/`cpm` per riga: sommarli o mediarli darebbe numeri falsi.

const round = (n: number, digits = 2) => Math.round(n * 10 ** digits) / 10 ** digits;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** a / b, oppure undefined quando il divisore è zero: "non misurabile", non "zero". */
export function ratio(a: number, b: number, scale = 1, digits = 2): number | undefined {
    return b > 0 ? round((a / b) * scale, digits) : undefined;
}

export interface MetaTotals {
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
}

export function metaDerived(t: MetaTotals) {
    return {
        ctrPct: ratio(t.clicks, t.impressions, 100),
        cpc: ratio(t.spend, t.clicks),
        cpm: ratio(t.spend, t.impressions, 1000),
        costPerLead: ratio(t.spend, t.leads),
        // % di click che diventano lead
        leadRatePct: ratio(t.leads, t.clicks, 100),
    };
}

type Row = Record<string, string | number | undefined>;

/**
 * Riga del report Meta con le colonne derivate. `ctr`/`cpc` originali di Windsor restano com'erano;
 * quelle nuove si chiamano come servono alla UI (leads, cost_per_lead, ctr_pct, cpm_calc, lead_rate_pct).
 */
export function withMetaDerived(row: Row): Row {
    const spend = num(row.spend);
    const leads = num(row.actions_lead);
    const d = metaDerived({ spend, impressions: num(row.impressions), clicks: num(row.clicks), leads });
    return {
        ...row,
        leads: leads || undefined,
        cost_per_lead: d.costPerLead,
        ctr_pct: d.ctrPct,
        cpc_calc: d.cpc,
        cpm_calc: d.cpm,
        lead_rate_pct: d.leadRatePct,
    };
}
