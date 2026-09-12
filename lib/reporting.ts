/**
 * lib/reporting.ts
 *
 * Aggregates a single client's marketing data across whichever Windsor.ai
 * connectors that client has mapped — Meta Ads/Google Ads/GA4 via the existing
 * metaAdAccountId/googleAdAccountId/ga4PropertyId fields (Setup API tab),
 * Instagram/Search Console/LinkedIn via `Client.windsorAccounts` (lib/data.ts).
 * Used by app/api/clients/[id]/reporting/route.ts for the "Report Marketing"
 * tab (components/MarketingReportTab.tsx) — Fase 1 della roadmap marketing
 * platform.
 *
 * Each platform's fields are intentionally minimal for this first slice — add
 * fields here as the dashboard UI grows, rather than over-fetching up front.
 */

import { getData } from './windsor-client';
import type { Client } from './data';

// metaAdAccountId/googleAdAccountId/ga4PropertyId are set by the existing "Setup
// API" tab (components/PlatformConnections.tsx) and stored on the client's
// Firestore doc, but aren't part of the typed Client interface (the codebase
// stores several fields this way, read back via `...doc.data()`). Accept them
// here too so a client only has to configure Meta/Google Ads/GA4 once, in the
// place staff already knows, instead of re-entering the same ids for Windsor.
type ClientReportSource = Pick<Client, 'windsorAccounts'> & {
    metaAdAccountId?: string;
    googleAdAccountId?: string;
    ga4PropertyId?: string;
};

export interface PlatformReport {
    platform: 'facebook' | 'instagram' | 'google_ads' | 'ga4' | 'searchconsole' | 'linkedin_organic' | 'gbp';
    /** Set for platforms that can have several accounts per client (GBP: one per sede). */
    accountLabel?: string;
    connected: boolean;
    error?: string;
    rows: Record<string, string | number | undefined>[];
    /** Same shape as `rows`, for the comparison window. Empty when not comparing. */
    previousRows?: Record<string, string | number | undefined>[];
}

// ⚠️ Every field id below must exist in that connector's Windsor catalogue.
// Windsor does NOT reject an unknown field id — it returns the column filled
// with nulls, so a typo shows up as an empty dashboard with no error anywhere.
// Verify ids against the connector's field list (MCP get_fields, or
// GET /{connector}/fields) before adding any; several of these were wrong in
// the first pass precisely because they were guessed from the platforms' own
// API naming (activeUsers, totalRevenue, followers, actions... none exist).
const PLATFORM_FIELDS: Record<PlatformReport['platform'], { connector: import('./windsor-client').WindsorConnector; fields: string[] }> = {
    facebook: { connector: 'facebook', fields: ['spend', 'clicks', 'impressions', 'reach', 'ctr', 'cpc'] },
    instagram: { connector: 'instagram', fields: ['followers_count', 'reach', 'profile_views', 'likes'] },
    google_ads: { connector: 'google_ads', fields: ['clicks', 'impressions', 'cost', 'conversions', 'ctr', 'cpc'] },
    ga4: { connector: 'googleanalytics4', fields: ['sessions', 'active_users', 'conversions', 'purchase_revenue'] },
    searchconsole: { connector: 'searchconsole', fields: ['clicks', 'impressions', 'ctr', 'position'] },
    linkedin_organic: {
        connector: 'linkedin_organic',
        fields: [
            'account_analytics_impression_count',
            'account_analytics_click_count',
            'account_analytics_like_count',
            'organization_follower_count',
        ],
    },
    // ⚠️ STILL UNVERIFIED, unlike every other line above. Windsor refuses to
    // serve a connector's field catalogue while no account is attached to it
    // ("No google_my_business accounts are configured"), so these four are
    // guesses. Given Windsor returns nulls rather than an error for unknown
    // ids, a wrong guess here shows up as an empty GBP section, not as a
    // visible error — so verify them with get_fields the moment GBP is
    // connected, before trusting anything this section displays.
    gbp: { connector: 'google_my_business', fields: ['impressions', 'website_clicks', 'call_clicks', 'direction_requests'] },
};

/**
 * Windsor returns one row per underlying table/day/post, each carrying only the
 * subset of requested fields that table knows about — Instagram, for example,
 * comes back as ~30 rows where `likes` is per-post, while `followers_count`
 * and `reach` each sit alone on their own row. Reading rows[0] therefore reads
 * an almost-empty row. Summing every non-null numeric per field collapses that
 * into one total, and is correct for the single-row connectors too (a lone
 * value sums to itself).
 */
function aggregateRows(rows: Record<string, string | number | undefined>[]): Record<string, string | number | undefined> {
    const totals: Record<string, string | number | undefined> = {};
    for (const row of rows) {
        for (const [key, value] of Object.entries(row)) {
            if (value === null || value === undefined) continue;
            if (typeof value === 'number') {
                totals[key] = ((totals[key] as number) || 0) + value;
            } else if (totals[key] === undefined) {
                totals[key] = value; // account_id / account_name and friends
            }
        }
    }
    return totals;
}

export type CompareMode = 'prev_period' | 'prev_year' | 'none';

/** Shape the "Performance Dominio" panel reads: a value plus its % change. */
export interface Metric { val: number; chg: number }

export interface GA4Overview {
    traffic: { sessions: Metric; users: Metric; newUsers: Metric; returningUsers: Metric };
    behavior: { bounceRate: Metric; engagementRate: Metric; avgSessionDuration: Metric; pagesPerSession: Metric };
    conversions: { totalConversions: Metric; conversionRate: Metric; transactions: Metric; revenue: Metric };
}

// All verified against Windsor's GA4 catalogue — note `newusers` has no
// underscore, unlike every other id here.
const GA4_OVERVIEW_FIELDS = [
    'sessions', 'active_users', 'newusers',
    'bounce_rate', 'engagement_rate', 'average_session_duration', 'screen_page_views_per_session',
    'conversions', 'session_conversion_rate', 'transactions', 'purchase_revenue',
];

/**
 * GA4 numbers for the "Performance Dominio" panel, via Windsor rather than the
 * per-client Google OAuth the Hub's own ga4-client requires — most clients only
 * ever get their GA4 Property ID mapped, never the OAuth token, which is why
 * that panel was empty.
 */
export async function getGA4Overview(
    propertyId: string,
    windows: { current: { dateFrom: string; dateTo: string }; previous: { dateFrom: string; dateTo: string } | null }
): Promise<GA4Overview> {
    const fetchWindow = async (w: { dateFrom: string; dateTo: string }) => {
        const rows = await getData({
            connector: 'googleanalytics4',
            accountId: propertyId,
            fields: [...GA4_OVERVIEW_FIELDS, 'account_id', 'account_name'],
            dateFrom: w.dateFrom,
            dateTo: w.dateTo,
        });
        return aggregateRows(rows);
    };

    const [cur, prev] = await Promise.all([
        fetchWindow(windows.current),
        windows.previous ? fetchWindow(windows.previous) : Promise.resolve({}),
    ]);

    const num = (r: Record<string, string | number | undefined>, k: string) =>
        typeof r[k] === 'number' ? (r[k] as number) : 0;

    const metric = (key: string, derive?: (r: Record<string, string | number | undefined>) => number): Metric => {
        const c = derive ? derive(cur) : num(cur, key);
        const p = derive ? derive(prev) : num(prev, key);
        return { val: Math.round(c * 100) / 100, chg: p === 0 ? 0 : Math.round(((c - p) / p) * 1000) / 10 };
    };

    // GA4 has no "returning users" metric; it's active users minus new ones.
    const returning = (r: Record<string, string | number | undefined>) =>
        Math.max(0, num(r, 'active_users') - num(r, 'newusers'));
    // Windsor returns rates as fractions (0.2761 = 27.61%).
    const asPercent = (key: string) => (r: Record<string, string | number | undefined>) => num(r, key) * 100;

    return {
        traffic: {
            sessions: metric('sessions'),
            users: metric('active_users'),
            newUsers: metric('newusers'),
            returningUsers: metric('', returning),
        },
        behavior: {
            bounceRate: metric('', asPercent('bounce_rate')),
            engagementRate: metric('', asPercent('engagement_rate')),
            avgSessionDuration: metric('average_session_duration'),
            pagesPerSession: metric('screen_page_views_per_session'),
        },
        conversions: {
            totalConversions: metric('conversions'),
            conversionRate: metric('', asPercent('session_conversion_rate')),
            transactions: metric('transactions'),
            revenue: metric('purchase_revenue'),
        },
    };
}

function toIso(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/**
 * Current window and the one it's compared against, as explicit dates.
 * Windsor's date_preset can't express "the 30 days before the last 30", so
 * comparison windows are always sent as date_from/date_to instead.
 */
export function buildWindows(days: number, compare: CompareMode) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days);

    const current = { dateFrom: toIso(start), dateTo: toIso(end) };
    if (compare === 'none') return { current, previous: null };

    const prevEnd = new Date(start);
    const prevStart = new Date(start);
    if (compare === 'prev_year') {
        prevEnd.setFullYear(prevEnd.getFullYear() - 1);
        prevStart.setFullYear(prevStart.getFullYear() - 1);
        prevEnd.setDate(prevEnd.getDate() + days);
    } else {
        prevStart.setDate(prevStart.getDate() - days);
    }
    return { current, previous: { dateFrom: toIso(prevStart), dateTo: toIso(prevEnd) } };
}

/**
 * Fetch every platform this client has connected on Windsor, in parallel.
 * A single platform failing (missing account, Windsor error, etc.) never takes
 * down the whole report — it comes back as its own `{connected:false, error}`
 * entry so the UI can show a per-platform state instead of a blank page.
 *
 * When `compare` is set, the same query runs for the comparison window and the
 * totals land in `previousRows`, so the UI can show deltas without a second
 * round trip.
 */
export async function getClientMarketingReport(
    client: ClientReportSource,
    datePreset = 'last_30d',
    windows?: { current: { dateFrom: string; dateTo: string }; previous: { dateFrom: string; dateTo: string } | null }
): Promise<PlatformReport[]> {
    // facebook/google_ads/ga4 prefer the ids already entered in "Setup API";
    // instagram/searchconsole/linkedin_organic only exist under windsorAccounts.
    const mapping: Record<string, string | undefined> = {
        facebook: client.metaAdAccountId,
        google_ads: client.googleAdAccountId,
        ga4: client.ga4PropertyId,
        instagram: client.windsorAccounts?.instagram,
        searchconsole: client.windsorAccounts?.searchconsole,
        linkedin_organic: client.windsorAccounts?.linkedin_organic,
    };

    const platforms = (Object.keys(PLATFORM_FIELDS) as PlatformReport['platform'][])
        .filter((platform) => mapping[platform]);

    // GBP is the one platform a client can have several of (one account per
    // sede), so it's fetched per-account rather than once per platform. Each
    // sede becomes its own entry, labelled with the name Windsor returns.
    const gbpAccountIds = (client.windsorAccounts?.gbp || []).filter(Boolean);

    if (platforms.length === 0 && gbpAccountIds.length === 0) return [];

    const fetchOne = async (
        platform: PlatformReport['platform'],
        accountId: string
    ): Promise<PlatformReport> => {
        const { connector, fields } = PLATFORM_FIELDS[platform];
        const allFields = [...fields, 'account_id', 'account_name'];
        try {
            const [rows, previousRows] = await Promise.all([
                getData({
                    connector, accountId, fields: allFields,
                    ...(windows ? { dateFrom: windows.current.dateFrom, dateTo: windows.current.dateTo } : { datePreset }),
                }),
                windows?.previous
                    ? getData({
                        connector, accountId, fields: allFields,
                        dateFrom: windows.previous.dateFrom, dateTo: windows.previous.dateTo,
                    })
                    : Promise.resolve([]),
            ]);
            return {
                platform,
                connected: true,
                accountLabel: (rows[0]?.account_name as string) || undefined,
                // One aggregated row — see aggregateRows for why raw rows can't
                // be read positionally.
                rows: rows.length > 0 ? [aggregateRows(rows)] : [],
                previousRows: previousRows.length > 0 ? [aggregateRows(previousRows)] : [],
            };
        } catch (err: any) {
            console.error(`[reporting] ${platform} failed for account ${accountId}:`, err.message);
            return { platform, connected: false, error: err.message, rows: [], previousRows: [] };
        }
    };

    const results = await Promise.all([
        ...platforms.map((platform) => fetchOne(platform, mapping[platform]!)),
        ...gbpAccountIds.map(async (accountId) => {
            const report = await fetchOne('gbp', accountId);
            // Keep the sede identifiable even when the fetch failed and there
            // are no rows to read a name from.
            return { ...report, accountLabel: report.accountLabel || accountId };
        }),
    ]);

    return results;
}
