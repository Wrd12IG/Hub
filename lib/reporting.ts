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
    platform: 'facebook' | 'instagram' | 'google_ads' | 'ga4' | 'searchconsole' | 'linkedin_organic';
    connected: boolean;
    error?: string;
    rows: Record<string, string | number | undefined>[];
}

const PLATFORM_FIELDS: Record<PlatformReport['platform'], { connector: import('./windsor-client').WindsorConnector; fields: string[] }> = {
    facebook: { connector: 'facebook', fields: ['spend', 'clicks', 'impressions', 'reach', 'ctr', 'cpc', 'actions'] },
    instagram: { connector: 'instagram', fields: ['followers', 'reach', 'impressions', 'profile_views'] },
    google_ads: { connector: 'google_ads', fields: ['clicks', 'impressions', 'cost', 'conversions', 'ctr', 'cpc'] },
    ga4: { connector: 'googleanalytics4', fields: ['sessions', 'activeUsers', 'conversions', 'totalRevenue'] },
    searchconsole: { connector: 'searchconsole', fields: ['clicks', 'impressions', 'ctr', 'position'] },
    linkedin_organic: { connector: 'linkedin_organic', fields: ['impressions', 'clicks', 'likes', 'shares'] },
};

/**
 * Fetch every platform this client has connected on Windsor, in parallel.
 * A single platform failing (missing account, Windsor error, etc.) never takes
 * down the whole report — it comes back as its own `{connected:false, error}`
 * entry so the UI can show a per-platform state instead of a blank page.
 */
export async function getClientMarketingReport(
    client: ClientReportSource,
    datePreset = 'last_30d'
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

    if (platforms.length === 0) return [];

    const results = await Promise.all(
        platforms.map(async (platform): Promise<PlatformReport> => {
            const accountId = mapping[platform]!;
            const { connector, fields } = PLATFORM_FIELDS[platform];
            try {
                const rows = await getData({ connector, accountId, fields: [...fields, 'account_id', 'account_name'], datePreset });
                return { platform, connected: true, rows };
            } catch (err: any) {
                console.error(`[reporting] ${platform} failed for account ${accountId}:`, err.message);
                return { platform, connected: false, error: err.message, rows: [] };
            }
        })
    );

    return results;
}
