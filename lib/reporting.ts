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
import { getGA4Totals } from './ga4-client';
import { getSearchConsoleTotals } from './search-console-client';
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
// ga4 e searchconsole sono letti nativi da Google col service account
// dell'agenzia, non da Windsor: restano nel tipo PlatformReport (la UI li
// mostra come gli altri) ma non hanno un connector qui.
type WindsorPlatform = Exclude<PlatformReport['platform'], 'ga4' | 'searchconsole'>;

const PLATFORM_FIELDS: Record<WindsorPlatform, { connector: import('./windsor-client').WindsorConnector; fields: string[] }> = {
    facebook: { connector: 'facebook', fields: ['spend', 'clicks', 'impressions', 'reach', 'ctr', 'cpc'] },
    instagram: { connector: 'instagram', fields: ['followers_count', 'reach', 'profile_views', 'likes'] },
    google_ads: { connector: 'google_ads', fields: ['clicks', 'impressions', 'cost', 'conversions', 'ctr', 'cpc'] },
    linkedin_organic: {
        connector: 'linkedin_organic',
        fields: [
            'account_analytics_impression_count',
            'account_analytics_click_count',
            'account_analytics_like_count',
            'organization_follower_count',
        ],
    },
    // Verificati con get_fields e contro i dati reali delle sedi appena GBP è
    // stato collegato: i quattro id di performance c'erano già giusti. Le due
    // voci sulle recensioni sono nuove — GBP le espone su una riga a parte,
    // dove i campi di performance sono null e viceversa.
    // `review_count` è il numero di recensioni *nel periodo* (segue il
    // selettore Periodo), `review_average_rating_total` è il rating
    // complessivo di sempre: è il numero che un cliente si aspetta di vedere,
    // mentre la media del solo periodo su due recensioni non dice nulla.
    gbp: {
        connector: 'google_my_business',
        fields: [
            'impressions', 'website_clicks', 'call_clicks', 'direction_requests',
            'review_count', 'review_average_rating_total',
        ],
    },
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
/**
 * Campi che NON vanno sommati anche se numerici, perché non sono quantità per
 * riga ma tassi, medie o totali già calcolati da chi ce li manda. Sommarli dà
 * numeri assurdi in silenzio: un rating 4,5 ripetuto su due righe diventa 9,0,
 * un totale recensioni di 117 diventa 234, un CTR dell'1% diventa 30% su
 * trenta giorni. Per questi si tiene il primo valore non nullo.
 *
 * Oggi la maggior parte di questi connector risponde con una riga sola e il
 * problema non si vede — ma è esattamente il tipo di bug che compare mesi dopo,
 * quando Windsor cambia granularità, e che nessuno collega alla causa.
 */
const NON_SUMMABLE = new Set([
    'ctr', 'cpc', 'position',
    'bounce_rate', 'engagement_rate', 'session_conversion_rate',
    'average_session_duration', 'screen_page_views_per_session',
    'followers_count', 'organization_follower_count',
    'review_count', 'review_total_count',
    'review_average_rating', 'review_average_rating_total',
]);

function aggregateRows(rows: Record<string, string | number | undefined>[]): Record<string, string | number | undefined> {
    const totals: Record<string, string | number | undefined> = {};
    for (const row of rows) {
        for (const [key, value] of Object.entries(row)) {
            if (value === null || value === undefined) continue;
            if (typeof value === 'number' && !NON_SUMMABLE.has(key)) {
                totals[key] = ((totals[key] as number) || 0) + value;
            } else if (totals[key] === undefined) {
                totals[key] = value; // account_id / account_name, tassi e medie
            }
        }
    }
    return totals;
}

/**
 * Esegue al massimo `limit` operazioni alla volta.
 *
 * Serve per GBP, l'unica piattaforma con molti account per cliente: una sede
 * risponde in 10-12 secondi, e lanciando tutte le sedi × due finestre insieme
 * Windsor comincia a chiudere le connessioni (ETIMEDOUT) — misurato su un
 * cliente con 4 sedi, dove due richieste su otto morivano mentre le stesse,
 * eseguite in sequenza, rispondevano entrambe.
 */
async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i]);
        }
    });
    await Promise.all(workers);
    return results;
}

export type CompareMode = 'prev_period' | 'prev_year' | 'none';

/** yyyy-MM-dd, N giorni fa: la Search Console API non accetta "Ndaysago". */
function isoDaysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
}

/** GA4's API takes "Ndaysago", not Windsor's presets. */
function presetToDays(preset: string): number {
    const m = /^last_(\d+)d$/.exec(preset);
    return m ? parseInt(m[1], 10) : 30;
}

/** Shape the "Performance Dominio" panel reads: a value plus its % change. */
export interface Metric { val: number; chg: number }

export interface GA4Overview {
    traffic: { sessions: Metric; users: Metric; newUsers: Metric; returningUsers: Metric };
    behavior: { bounceRate: Metric; engagementRate: Metric; avgSessionDuration: Metric; pagesPerSession: Metric };
    conversions: { totalConversions: Metric; conversionRate: Metric; transactions: Metric; revenue: Metric };
}

/**
 * GA4 numbers for the "Performance Dominio" panel, read natively from Google's
 * own API with the agency service account (see lib/ga4-client.ts) rather than
 * through Windsor. Same numbers — verified side by side on the pilot property,
 * 5536 vs 5517 sessions, a difference explained entirely by the rolling window
 * shifting between the two calls — but free, unlimited by Windsor's connected
 * account count, and with the full GA4 metric catalogue available.
 */
export async function getGA4Overview(
    propertyId: string,
    windows: { current: { dateFrom: string; dateTo: string }; previous: { dateFrom: string; dateTo: string } | null }
): Promise<GA4Overview> {
    const fetchWindow = (w: { dateFrom: string; dateTo: string }) =>
        getGA4Totals(propertyId, w.dateFrom, w.dateTo);

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
    // GA4 returns rates as fractions (0.2761 = 27.61%).
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
    // instagram/linkedin_organic only exist under windsorAccounts.
    const mapping: Record<string, string | undefined> = {
        facebook: client.metaAdAccountId,
        google_ads: client.googleAdAccountId,
        ga4: client.ga4PropertyId,
        instagram: client.windsorAccounts?.instagram,
        linkedin_organic: client.windsorAccounts?.linkedin_organic,
    };

    const platforms = (Object.keys(PLATFORM_FIELDS) as WindsorPlatform[])
        .filter((platform) => mapping[platform]);

    // GBP is the one platform a client can have several of (one account per
    // sede), so it's fetched per-account rather than once per platform. Each
    // sede becomes its own entry, labelled with the name Windsor returns.
    const gbpAccountIds = (client.windsorAccounts?.gbp || []).filter(Boolean);

    const searchConsoleSite = client.windsorAccounts?.searchconsole;

    // ⚠️ Questa guardia deve contare anche GA4 e Search Console, non solo le
    // piattaforme Windsor: da quando quelle due sono native, un cliente che ha
    // *soltanto* Analytics e/o Search Console collegati usciva di qui con un
    // report vuoto senza alcun errore, pur avendo dati validi.
    if (platforms.length === 0 && gbpAccountIds.length === 0 && !client.ga4PropertyId && !searchConsoleSite) {
        return [];
    }

    const fetchOne = async (
        platform: WindsorPlatform,
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

    // GA4 is read natively from Google (service account), not through Windsor:
    // free, no per-client OAuth, and it doesn't consume a Windsor account slot.
    // It still emits the same keys the UI reads, so nothing downstream changes.
    const fetchGa4 = async (propertyId: string): Promise<PlatformReport> => {
        try {
            const [cur, prev] = await Promise.all([
                windows
                    ? getGA4Totals(propertyId, windows.current.dateFrom, windows.current.dateTo)
                    : getGA4Totals(propertyId, `${presetToDays(datePreset)}daysAgo`, 'today'),
                windows?.previous
                    ? getGA4Totals(propertyId, windows.previous.dateFrom, windows.previous.dateTo)
                    : Promise.resolve(null),
            ]);
            return {
                platform: 'ga4',
                connected: true,
                rows: [cur],
                previousRows: prev ? [prev] : [],
            };
        } catch (err: any) {
            console.error(`[reporting] ga4 failed for property ${propertyId}:`, err.message);
            return { platform: 'ga4', connected: false, error: err.message, rows: [], previousRows: [] };
        }
    };

    // Search Console: stessa storia di GA4 — API ufficiale di Google col service
    // account dell'agenzia. L'id salvato è già l'URL della proprietà, quindi
    // vale tale e quale sia per Windsor sia per l'API nativa.
    const fetchSearchConsole = async (siteUrl: string): Promise<PlatformReport> => {
        try {
            const [cur, prev] = await Promise.all([
                windows
                    ? getSearchConsoleTotals(siteUrl, windows.current.dateFrom, windows.current.dateTo)
                    : getSearchConsoleTotals(siteUrl, isoDaysAgo(presetToDays(datePreset)), isoDaysAgo(0)),
                windows?.previous
                    ? getSearchConsoleTotals(siteUrl, windows.previous.dateFrom, windows.previous.dateTo)
                    : Promise.resolve(null),
            ]);
            return { platform: 'searchconsole', connected: true, rows: [cur], previousRows: prev ? [prev] : [] };
        } catch (err: any) {
            console.error(`[reporting] searchconsole failed for ${siteUrl}:`, err.message);
            return { platform: 'searchconsole', connected: false, error: err.message, rows: [], previousRows: [] };
        }
    };

    // Le sedi GBP passano da un pool: sono l'unico caso in cui un cliente ha
    // molti account sulla stessa piattaforma, e in parallelo Windsor le rifiuta.
    const [single, gbp] = await Promise.all([
        Promise.all([
            ...platforms.map((platform) => fetchOne(platform, mapping[platform]!)),
            ...(client.ga4PropertyId ? [fetchGa4(client.ga4PropertyId)] : []),
            ...(searchConsoleSite ? [fetchSearchConsole(searchConsoleSite)] : []),
        ]),
        mapWithConcurrency(gbpAccountIds, 2, async (accountId) => {
            const report = await fetchOne('gbp', accountId);
            // Keep the sede identifiable even when the fetch failed and there
            // are no rows to read a name from.
            return { ...report, accountLabel: report.accountLabel || accountId };
        }),
    ]);

    return [...single, ...gbp];
}
