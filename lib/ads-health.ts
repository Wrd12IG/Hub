/**
 * lib/ads-health.ts
 *
 * "Health Score Ads": how well a client's advertising is set up, scored per
 * platform (Google Ads, Meta) from the real campaign data the Hub already
 * fetches in app/api/clients/[id]/campaigns.
 *
 * Deliberately a small, transparent formula rather than a black box: each
 * factor is reported alongside the score with its own value and weight, so the
 * UI can show *why* a client scores what they score. The card this feeds used
 * to be permanently stuck on "Mai analizzato" because `lastAuditScore` was
 * read in two places and written nowhere.
 *
 * A factor that can't be judged (no spend at all on a platform, so CTR means
 * nothing) is returned as `applicable: false` and dropped from the weighting
 * instead of silently scoring zero — a client who simply isn't running Meta
 * ads shouldn't look "critical" on Meta.
 */

export interface HealthFactor {
    id: 'conversions' | 'ctr' | 'delivery';
    label: string;
    /** What was measured, in plain words, for the UI to show under the score. */
    detail: string;
    weight: number;
    /** 0..1 — how much of this factor's weight was earned. */
    ratio: number;
    applicable: boolean;
}

export interface PlatformHealth {
    platform: 'google_ads' | 'meta';
    label: string;
    /** 0..100, or null when there's nothing to score (no campaigns/spend). */
    score: number | null;
    spend: number;
    campaigns: number;
    factors: HealthFactor[];
}

interface CampaignLike {
    platform: 'meta' | 'google_ads';
    status: 'active' | 'paused' | 'ended';
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
}

/**
 * CTR bands, shown in the UI next to the score so the judgement is visible
 * rather than implied. Search and social CTRs aren't comparable, hence the
 * per-platform split.
 */
const CTR_BANDS = {
    google_ads: { poor: 0.02, good: 0.05 },
    meta: { poor: 0.005, good: 0.015 },
} as const;

function pct(n: number): string {
    return `${(n * 100).toFixed(2)}%`;
}

function scorePlatform(platform: 'google_ads' | 'meta', campaigns: CampaignLike[]): PlatformHealth {
    const label = platform === 'google_ads' ? 'Google Ads' : 'Meta Ads';
    const spend = campaigns.reduce((s, c) => s + (c.spend || 0), 0);
    const clicks = campaigns.reduce((s, c) => s + (c.clicks || 0), 0);
    const impressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0);

    if (campaigns.length === 0) {
        return { platform, label, score: null, spend: 0, campaigns: 0, factors: [] };
    }

    // ── 1. Conversion tracking (weight 45) ────────────────────────────────
    // Share of spend that sits on campaigns which produced at least one
    // conversion. Spend with no conversions anywhere is the loudest signal in
    // any ad account audit: either tracking isn't wired up, or the money isn't
    // working. Nothing else in this score matters as much.
    const spendWithConversions = campaigns
        .filter((c) => (c.conversions || 0) > 0)
        .reduce((s, c) => s + (c.spend || 0), 0);
    const conversionsFactor: HealthFactor = {
        id: 'conversions',
        label: 'Conversioni tracciate',
        weight: 45,
        applicable: spend > 0,
        ratio: spend > 0 ? spendWithConversions / spend : 0,
        detail: spend > 0
            ? `${pct(spendWithConversions / spend)} della spesa su campagne che hanno convertito`
            : 'Nessuna spesa nel periodo: non valutabile',
    };

    // ── 2. CTR (weight 30) ────────────────────────────────────────────────
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const band = CTR_BANDS[platform];
    const ctrRatio = ctr <= band.poor
        ? (ctr / band.poor) * 0.5                                  // 0 → 0.5 fino alla soglia bassa
        : Math.min(1, 0.5 + ((ctr - band.poor) / (band.good - band.poor)) * 0.5);
    const ctrFactor: HealthFactor = {
        id: 'ctr',
        label: 'CTR',
        weight: 30,
        applicable: impressions > 0,
        ratio: ctrRatio,
        detail: impressions > 0
            ? `${pct(ctr)} (sotto ${pct(band.poor)} = scarso, sopra ${pct(band.good)} = buono)`
            : 'Nessuna impression nel periodo: non valutabile',
    };

    // ── 3. Campagne attive che erogano (weight 25) ────────────────────────
    // An "active" campaign with zero impressions in the window is a broken or
    // starved setup — approved but not delivering.
    const active = campaigns.filter((c) => c.status === 'active');
    const activeDelivering = active.filter((c) => (c.impressions || 0) > 0);
    const deliveryFactor: HealthFactor = {
        id: 'delivery',
        label: 'Campagne attive che erogano',
        weight: 25,
        applicable: active.length > 0,
        ratio: active.length > 0 ? activeDelivering.length / active.length : 0,
        detail: active.length > 0
            ? `${activeDelivering.length} su ${active.length} campagne attive hanno erogato impression`
            : 'Nessuna campagna attiva nel periodo: non valutabile',
    };

    const factors = [conversionsFactor, ctrFactor, deliveryFactor];
    const applicable = factors.filter((f) => f.applicable);
    const totalWeight = applicable.reduce((s, f) => s + f.weight, 0);
    const score = totalWeight === 0
        ? null
        : Math.round(applicable.reduce((s, f) => s + f.ratio * f.weight, 0) / totalWeight * 100);

    return { platform, label, score, spend, campaigns: campaigns.length, factors };
}

/** One health score per platform the client actually has campaigns on. */
export function computeAdsHealth(campaigns: CampaignLike[]): PlatformHealth[] {
    return (['google_ads', 'meta'] as const)
        .map((p) => scorePlatform(p, campaigns.filter((c) => c.platform === p)))
        .filter((h) => h.campaigns > 0);
}

/** Weighted by spend: a platform running most of the budget should dominate. */
export function overallAdsHealth(health: PlatformHealth[]): number | null {
    const scored = health.filter((h) => h.score !== null);
    if (scored.length === 0) return null;
    const totalSpend = scored.reduce((s, h) => s + h.spend, 0);
    if (totalSpend === 0) {
        return Math.round(scored.reduce((s, h) => s + (h.score as number), 0) / scored.length);
    }
    return Math.round(scored.reduce((s, h) => s + (h.score as number) * h.spend, 0) / totalSpend);
}
