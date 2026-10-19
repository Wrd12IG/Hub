// Report di una singola campagna Meta (il modale «Report» della tab Campagne), calcolato dalle righe che Windsor
// restituisce. Pura: nessuna rete. Sostituisce il vecchio percorso che chiedeva a Meta un token OAuth per cliente (che
// nessun cliente ha) e restituiva comunque una forma diversa da quella che il modale legge.

import { ratio } from './meta-metrics';
import { PURCHASE_FIELDS } from './meta-breakdown';

/** Campi Windsor da chiedere per una campagna. */
export const CAMPAIGN_REPORT_FIELDS = [
    'campaign', 'campaign_id', 'campaign_objective', 'spend', 'impressions', 'reach', 'clicks', 'actions_lead',
    'actions_landing_page_view', 'outbound_clicks_outbound_click', 'actions_post_engagement', 'actions_video_view',
    'actions_like', 'actions_comment', 'actions_post', 'actions_post_reaction',
    'actions_onsite_conversion_total_messaging_connection', 'actions_add_to_cart', 'actions_initiate_checkout',
    'action_values_omni_purchase', 'action_values_purchase', ...PURCHASE_FIELDS, 'account_id',
];

export type ReportObjective = 'SALES' | 'LEADS' | 'TRAFFIC' | 'ENGAGEMENT' | 'AWARENESS' | 'ALTRO';

/** Gli obiettivi di Meta (nuovi OUTCOME_* e vecchi) ridotti ai cinque che il modale sa raccontare. */
export function normalizeObjective(raw: unknown): ReportObjective {
    const s = String(raw ?? '').toUpperCase();
    if (/(SALES|CONVERSIONS|CATALOG|PRODUCT_CATALOG)/.test(s)) return 'SALES';
    if (/LEAD/.test(s)) return 'LEADS';
    if (/(TRAFFIC|LINK_CLICKS)/.test(s)) return 'TRAFFIC';
    if (/(ENGAGEMENT|POST_ENGAGEMENT|PAGE_LIKES|MESSAGES|VIDEO_VIEWS)/.test(s)) return 'ENGAGEMENT';
    if (/(AWARENESS|BRAND|REACH)/.test(s)) return 'AWARENESS';
    return 'ALTRO';
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** I periodi del selettore del modale come intervallo di date. */
export function presetDates(preset: string, now = new Date()): { from: string; to: string } {
    const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
    switch (preset) {
        case 'today': return { from: iso(now), to: iso(now) };
        case 'yesterday': { const t = new Date(y, m, d - 1); return { from: iso(t), to: iso(t) }; }
        case 'last_7d': return { from: iso(new Date(y, m, d - 6)), to: iso(now) };
        case 'this_month': return { from: iso(new Date(y, m, 1)), to: iso(now) };
        case 'last_month': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
        case 'maximum': return { from: iso(new Date(y - 2, m, d)), to: iso(now) };
        case 'last_30d':
        default: return { from: iso(new Date(y, m, d - 29)), to: iso(now) };
    }
}

type Row = Record<string, string | number | null | undefined>;
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const sum = (rows: Row[], f: string) => rows.reduce((s, r) => s + n(r[f]), 0);
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface CampaignReport {
    objective: ReportObjective;
    /** Non c'è nessuna riga per questa campagna nel periodo. */
    empty: boolean;
    base: { spend: number; impressions: number; reach: number; frequency: number; cpm: number; clicks: number; ctr: number; cpc: number };
    specific: Record<string, number | null>;
}

/** Righe di UNA campagna (una per giorno e/o per azione) → metriche del modale. Tutto ricalcolato dai totali. */
export function buildCampaignReport(rows: Row[], objectiveHint?: string): CampaignReport {
    const spend = sum(rows, 'spend'), impressions = sum(rows, 'impressions'), clicks = sum(rows, 'clicks');
    // Il reach non si somma fra giorni (conta più volte le stesse persone) ma Windsor lo dà già per l'intero periodo se non c'è la data
    const reach = Math.max(0, ...rows.map((r) => n(r.reach)));
    const leads = sum(rows, 'actions_lead');
    const outbound = sum(rows, 'outbound_clicks_outbound_click');
    const engagements = sum(rows, 'actions_post_engagement');
    const purchaseField = PURCHASE_FIELDS.find((f) => sum(rows, f) > 0);
    const purchases = purchaseField ? sum(rows, purchaseField) : 0;
    const purchaseValue = sum(rows, 'action_values_omni_purchase') || sum(rows, 'action_values_purchase');

    // L'obiettivo lo dice Windsor; se manca o non è riconoscibile lo si deduce da cosa la campagna ha prodotto
    let objective = normalizeObjective(rows.map((r) => r.campaign_objective).find(Boolean) ?? objectiveHint);
    if (objective === 'ALTRO') objective = purchases > 0 ? 'SALES' : leads > 0 ? 'LEADS' : outbound > 0 ? 'TRAFFIC' : engagements > 0 ? 'ENGAGEMENT' : 'ALTRO';

    return {
        objective,
        empty: rows.length === 0,
        base: {
            spend: r2(spend), impressions, reach, frequency: ratio(impressions, reach) ?? 0,
            cpm: ratio(spend, impressions, 1000) ?? 0, clicks, ctr: ratio(clicks, impressions, 100) ?? 0, cpc: ratio(spend, clicks) ?? 0,
        },
        specific: {
            // SALES
            roas: purchaseValue > 0 && spend > 0 ? r2(purchaseValue / spend) : null,
            purchases, costPerPurchase: purchases > 0 ? r2(spend / purchases) : null, purchaseValue: r2(purchaseValue),
            addToCarts: sum(rows, 'actions_add_to_cart'), checkoutsInitiated: sum(rows, 'actions_initiate_checkout'),
            // LEADS
            leads, costPerLead: leads > 0 ? r2(spend / leads) : null, formCompletionRate: clicks > 0 ? r2((leads / clicks) * 100) : null,
            // TRAFFIC
            outboundClicks: outbound, outboundCtr: ratio(outbound, impressions, 100) ?? null,
            costPerOutboundClick: outbound > 0 ? r2(spend / outbound) : null, landingPageViews: sum(rows, 'actions_landing_page_view'),
            // ENGAGEMENT
            postEngagements: engagements, costPerEngagement: engagements > 0 ? Math.round((spend / engagements) * 1000) / 1000 : null,
            reactions: sum(rows, 'actions_post_reaction') || sum(rows, 'actions_like'), postComments: sum(rows, 'actions_comment'), postShares: sum(rows, 'actions_post'),
            messages: sum(rows, 'actions_onsite_conversion_total_messaging_connection'),
            // AWARENESS
            videoViews: sum(rows, 'actions_video_view'), reach: reach,
        },
    };
}
