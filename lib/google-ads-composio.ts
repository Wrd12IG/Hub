import { composioExecute } from '@/lib/composio-client';

// Google Ads letto da Composio (tool GOOGLEADS_SEARCH_STREAM_GAQL) con la stessa uscita di
// getGoogleAdsAccountTotals in google-ads-client.ts, così reporting.ts può scegliere la fonte.
//
// ⚠️ Il formato esatto della risposta di Composio NON è documentato (il campo `data` è dichiarato
// "string"): il parser accetta stringa JSON, array di batch o oggetto con `results`, e chiavi camelCase
// o snake_case. Da confermare con una chiamata reale (scripts/composio-google-ads-check.ts).

const TOOLKIT = 'googleads';
const TOOL = 'GOOGLEADS_SEARCH_STREAM_GAQL';

/** Estrae le righe da qualunque forma plausibile della risposta. */
export function extractGaqlRows(data: unknown): any[] {
    if (data == null) return [];
    if (typeof data === 'string') {
        try { return extractGaqlRows(JSON.parse(data)); } catch { return []; }
    }
    if (Array.isArray(data)) {
        // array di batch ({ results: [...] }) oppure array di righe
        return data.flatMap(item => (item && Array.isArray((item as any).results)) ? (item as any).results : [item]);
    }
    if (typeof data === 'object') {
        const o = data as any;
        if (Array.isArray(o.results)) return o.results;
        if (o.data !== undefined) return extractGaqlRows(o.data);
        if (o.response_data !== undefined) return extractGaqlRows(o.response_data);
    }
    return [];
}

const num = (m: any, camel: string, snake: string) => Number(m?.[camel] ?? m?.[snake] ?? 0);

/** Somma le righe e ricalcola ctr/cpc sui totali (sommare i tassi giornalieri non avrebbe senso). */
export function totalsFromRows(rows: any[]): Record<string, number> {
    let cost = 0, impressions = 0, clicks = 0, conversions = 0;
    for (const row of rows) {
        const m = row?.metrics || {};
        cost += num(m, 'costMicros', 'cost_micros') / 1_000_000;
        impressions += num(m, 'impressions', 'impressions');
        clicks += num(m, 'clicks', 'clicks');
        conversions += num(m, 'conversions', 'conversions');
    }
    return {
        cost: Math.round(cost * 100) / 100,
        impressions, clicks, conversions,
        ctr: impressions > 0 ? clicks / impressions : 0,
        cpc: clicks > 0 ? Math.round((cost / clicks) * 100) / 100 : 0,
    };
}

export async function getGoogleAdsAccountTotalsViaComposio(
    customerId: string,
    dateFrom: string,
    dateTo: string,
): Promise<Record<string, number>> {
    const { data } = await composioExecute(TOOLKIT, TOOL, {
        customer_id: customerId,
        query: `SELECT metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions
                FROM customer
                WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'`,
    });
    return totalsFromRows(extractGaqlRows(data));
}
