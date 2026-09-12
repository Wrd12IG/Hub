/**
 * lib/reporting.ts
 *
 * Aggregates a single client's marketing data across whichever Windsor.ai
 * connectors that client has mapped in `Client.windsorAccounts` (see lib/data.ts).
 * Used by app/api/clients/[id]/reporting/route.ts for the client-facing
 * reporting dashboard (Fase 1 della roadmap marketing platform).
 *
 * Each platform's fields are intentionally minimal for this first slice — add
 * fields here as the dashboard UI grows, rather than over-fetching up front.
 */

import { getData } from './windsor-client';
import type { Client } from './data';

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
    client: Pick<Client, 'windsorAccounts'>,
    datePreset = 'last_30d'
): Promise<PlatformReport[]> {
    const mapping = client.windsorAccounts || {};

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
