import { ratio } from './meta-metrics';

export interface CampaignRow {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
}

/** Totali e medie ricalcolate dai totali (mai la media delle medie): una campagna da 10 € non pesa come una da 300 €. */
export function summarizeCampaigns(rows: CampaignRow[]) {
    const t = rows.reduce(
        (acc, r) => ({
            spend: acc.spend + (r.spend || 0),
            impressions: acc.impressions + (r.impressions || 0),
            clicks: acc.clicks + (r.clicks || 0),
            conversions: acc.conversions + (r.conversions || 0),
        }),
        { spend: 0, impressions: 0, clicks: 0, conversions: 0 },
    );
    return { ...t, ...rowMetrics(t) };
}

/** Le percentuali e i costi di una riga: undefined quando il divisore è zero ("non misurabile", non "0"). */
export function rowMetrics(r: CampaignRow) {
    return {
        ctr: ratio(r.clicks, r.impressions, 100),
        cpc: ratio(r.spend, r.clicks),
        costPerConversion: ratio(r.spend, r.conversions),
    };
}
