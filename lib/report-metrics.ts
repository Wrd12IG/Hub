// Definizioni e calcoli del report marketing che non dipendono da React: etichette delle metriche, avvisi di scostamento
// e riepilogo. Sta qui (e non nel componente) perché li usano sia il riepilogo in alto sia le schede delle piattaforme.

import type { PlatformReport } from './reporting';
import { computeClientHealth } from './client-health';

export type PlatformKey = PlatformReport['platform'];
export interface MetricDef { key: string; label: string }

/** Metriche mostrate per piattaforma e quali usare come "titolo" della scheda chiusa (la prima con un valore). */
export const PLATFORM_DEFS: Record<PlatformKey, { label: string; metrics: MetricDef[]; headline: string[] }> = {
    facebook: {
        label: 'Meta Ads',
        metrics: [{ key: 'spend', label: 'Spesa €' }, { key: 'leads', label: 'Lead' }, { key: 'cost_per_lead', label: 'Costo per lead €' }, { key: 'lead_rate_pct', label: 'Click → lead %' }, { key: 'clicks', label: 'Click' }, { key: 'ctr_pct', label: 'CTR %' }, { key: 'cpc_calc', label: 'CPC €' }, { key: 'cpm_calc', label: 'CPM €' }, { key: 'impressions', label: 'Impression' }, { key: 'reach', label: 'Reach' }],
        headline: ['leads', 'spend'],
    },
    instagram: {
        label: 'Instagram',
        metrics: [{ key: 'followers_count', label: 'Follower' }, { key: 'reach', label: 'Reach' }, { key: 'likes', label: 'Like' }, { key: 'profile_views', label: 'Visite profilo' }],
        headline: ['reach', 'followers_count'],
    },
    google_ads: {
        label: 'Google Ads',
        metrics: [{ key: 'cost', label: 'Spesa €' }, { key: 'clicks', label: 'Click' }, { key: 'conversions', label: 'Conversioni' }, { key: 'impressions', label: 'Impression' }],
        headline: ['conversions', 'cost'],
    },
    ga4: {
        label: 'Google Analytics 4',
        metrics: [{ key: 'sessions', label: 'Sessioni' }, { key: 'active_users', label: 'Utenti attivi' }, { key: 'conversions', label: 'Conversioni' }, { key: 'purchase_revenue', label: 'Revenue €' }],
        headline: ['purchase_revenue', 'conversions', 'sessions'],
    },
    searchconsole: {
        label: 'Search Console',
        metrics: [{ key: 'clicks', label: 'Click organici' }, { key: 'impressions', label: 'Impression' }, { key: 'position', label: 'Posizione media' }],
        headline: ['clicks'],
    },
    linkedin_organic: {
        label: 'LinkedIn',
        metrics: [{ key: 'organization_follower_count', label: 'Follower' }, { key: 'account_analytics_impression_count', label: 'Impression' }, { key: 'account_analytics_click_count', label: 'Click' }, { key: 'account_analytics_like_count', label: 'Like' }],
        headline: ['account_analytics_impression_count', 'organization_follower_count'],
    },
    klaviyo: {
        label: 'Klaviyo (Email)',
        metrics: [{ key: 'recipients', label: 'Destinatari' }, { key: 'open_rate', label: 'Tasso apertura %' }, { key: 'conversion_value', label: 'Fatturato totale €' }, { key: 'flow_value', label: 'di cui flussi €' }, { key: 'campaign_value', label: 'di cui campagne €' }, { key: 'unsubscribe_rate', label: 'Disiscrizioni %' }],
        headline: ['conversion_value', 'recipients'],
    },
    awin: {
        label: 'Awin (Affiliazione)',
        metrics: [{ key: 'sale_amount', label: 'Ordini €' }, { key: 'transactions', label: 'Transazioni' }, { key: 'total_cost', label: 'Costo canale €' }, { key: 'roas', label: 'ROAS' }, { key: 'average_order_value', label: 'Scontrino medio €' }, { key: 'pending_sale_amount', label: 'Non confermato €' }],
        headline: ['sale_amount', 'transactions'],
    },
    gbp: {
        label: 'Google Business Profile',
        metrics: [{ key: 'contacts', label: 'Contatti' }, { key: 'impressions', label: 'Visualizzazioni' }, { key: 'website_clicks', label: 'Click sito' }, { key: 'call_clicks', label: 'Chiamate' }, { key: 'direction_requests', label: 'Indicazioni' }, { key: 'review_count', label: 'Nuove recensioni' }, { key: 'review_average_rating_total', label: 'Rating' }],
        headline: ['contacts', 'impressions'],
    },
};

/** Metriche per cui un aumento è una cattiva notizia. */
export const COST_KEYS = new Set(['spend', 'cost', 'cpc', 'cpc_calc', 'cpm_calc', 'cost_per_lead', 'position', 'unsubscribe_rate', 'bounced', 'spam_complaints', 'total_cost', 'pending_sale_amount']);

type Row = Record<string, string | number | undefined>;
const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// ── Avvisi di scostamento ──

export const ALERT_THRESHOLD_PCT = 25;

const MONEY = new Set(['spend', 'cost', 'sale_amount', 'purchase_revenue', 'conversion_value', 'flow_value', 'campaign_value', 'total_cost', 'pending_sale_amount']);
const RESULTS = new Set(['leads', 'conversions', 'transactions', 'contacts']);
const RATES = new Set(['ctr_pct', 'lead_rate_pct', 'cpc_calc', 'cpm_calc', 'cost_per_lead', 'open_rate', 'unsubscribe_rate', 'position', 'roas', 'average_order_value']);
/** Valori che non hanno senso come "scostamento": il rating medio si sposta di decimali, non di 25%. */
const NEVER = new Set(['review_average_rating_total', 'review_count']);

/** Base minima nel periodo precedente: sotto, una percentuale è rumore (da 2 a 3 lead è +50%). */
export const MIN_BASE = { money: 50, results: 10, counts: 30 };

/** Una tassa o un costo medio si confronta solo se dietro c'è volume: click, sessioni o invii sufficienti. */
function hasVolume(prev: Row): boolean {
    return n(prev.clicks) >= 100 || n(prev.sessions) >= 100 || n(prev.recipients) >= 1000 || n(prev.impressions) >= 5000;
}

export function hasEnoughBase(key: string, prev: Row): boolean {
    if (NEVER.has(key)) return false;
    const p = n(prev[key]);
    if (MONEY.has(key)) return p >= MIN_BASE.money;
    if (RESULTS.has(key)) return p >= MIN_BASE.results;
    if (RATES.has(key)) return hasVolume(prev);
    return p >= MIN_BASE.counts;
}

export interface ReportAlert { platform: string; key: string; label: string; value: number; good: boolean; from: number; to: number }

export function computeAlerts(platforms: PlatformReport[]): ReportAlert[] {
    return platforms.flatMap((p) => {
        const def = PLATFORM_DEFS[p.platform];
        const cur = p.rows?.[0];
        const prev = p.previousRows?.[0];
        if (!def || !p.connected || !cur || !prev) return [];
        return def.metrics.flatMap((m) => {
            const c = cur[m.key];
            const pv = prev[m.key];
            if (typeof c !== 'number' || typeof pv !== 'number' || pv === 0) return [];
            if (!hasEnoughBase(m.key, prev)) return [];
            const value = Math.round(((c - pv) / pv) * 1000) / 10;
            if (Math.abs(value) < ALERT_THRESHOLD_PCT) return [];
            return [{ platform: def.label + (p.accountLabel && p.platform === 'gbp' ? ` · ${p.accountLabel}` : ''), key: m.key, label: m.label, value, good: COST_KEYS.has(m.key) ? value < 0 : value > 0, from: pv, to: c }];
        });
    });
}

// ── Riepilogo in testa alla Panoramica ──

export interface ReportSummary {
    spend: { value: number; previous: number | null } | null;
    result: { label: string; value: number; previous: number | null; source: string } | null;
    /** Solo quando l'esito è di un canale a pagamento: spesa di QUEL canale diviso il suo risultato. */
    costPerResult: number | null;
    alerts: ReportAlert[];
}

const sumSpend = (platforms: PlatformReport[], which: 'rows' | 'previousRows') => {
    let total = 0;
    let seen = false;
    for (const p of platforms) {
        if (!p.connected || (p.platform !== 'facebook' && p.platform !== 'google_ads')) continue;
        const v = p[which]?.[0]?.[p.platform === 'facebook' ? 'spend' : 'cost'];
        if (typeof v === 'number') { total += v; seen = true; }
    }
    return seen ? total : null;
};

export function summarizeReport(platforms: PlatformReport[], days = 30): ReportSummary {
    const spendNow = sumSpend(platforms, 'rows');
    const spendPrev = sumSpend(platforms, 'previousRows');
    const health = computeClientHealth({ platforms, days });

    let costPerResult: number | null = null;
    if (health.current && health.current > 0 && (health.sourcePlatform === 'facebook' || health.sourcePlatform === 'google_ads')) {
        const own = platforms.find((p) => p.platform === health.sourcePlatform && p.connected);
        const spend = own?.rows?.[0]?.[health.sourcePlatform === 'facebook' ? 'spend' : 'cost'];
        if (typeof spend === 'number' && spend > 0) costPerResult = Math.round((spend / health.current) * 100) / 100;
    }

    return {
        spend: spendNow === null ? null : { value: Math.round(spendNow * 100) / 100, previous: spendPrev === null ? null : Math.round(spendPrev * 100) / 100 },
        result: health.metricLabel && health.current !== null ? { label: health.metricLabel, value: health.current, previous: health.previous, source: health.source ?? '' } : null,
        costPerResult,
        alerts: computeAlerts(platforms),
    };
}
