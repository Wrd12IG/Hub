import { composioExecute } from '@/lib/composio-client';

// YouTube letto da Composio (pilota). Un'identità Composio per canale/cliente: il canale si autorizza
// una volta con il Connect Link, niente token OAuth da incollare. Stessi parametri dell'API YouTube Analytics
// già usata in youtube-client.ts (YOUTUBE_QUERY_ANALYTICS è un passaggio diretto).
//
// ⚠️ Il formato delle risposte NON è confermato da una chiamata reale: parser tolleranti, da verificare con
// scripts/composio-youtube-check.ts.

const TOOLKIT = 'youtube';
export const ANALYTICS_METRICS =
    'views,estimatedMinutesWatched,averageViewDuration,likes,comments,shares,subscribersGained,subscribersLost';

/** Se `data` è una stringa JSON la decodifica; altrimenti la restituisce così com'è. */
function asObject(data: unknown): any {
    if (typeof data === 'string') { try { return JSON.parse(data); } catch { return null; } }
    return data;
}

/** Cerca l'oggetto che contiene `columnHeaders`/`rows` (risposta di YouTube Analytics), anche annidato in `data`. */
function findAnalyticsTable(data: unknown, depth = 0): { columnHeaders: any[]; rows: any[][] } | null {
    const o = asObject(data);
    if (!o || typeof o !== 'object' || depth > 3) return null;
    if (Array.isArray(o.columnHeaders) && Array.isArray(o.rows)) return o;
    for (const key of ['data', 'response_data', 'result']) {
        const found = o[key] !== undefined ? findAnalyticsTable(o[key], depth + 1) : null;
        if (found) return found;
    }
    return null;
}

/** Trasforma la tabella di YouTube Analytics (colonne + righe) in un oggetto { metrica: valore } sommando le righe. */
export function analyticsTotals(data: unknown): Record<string, number> {
    const table = findAnalyticsTable(data);
    if (!table) return {};
    const names = table.columnHeaders.map((h: any) => String(h?.name ?? h));
    const totals: Record<string, number> = {};
    for (const row of table.rows) {
        names.forEach((name, i) => {
            const value = Number(row[i]);
            if (!Number.isNaN(value)) totals[name] = (totals[name] || 0) + value;
        });
    }
    // averageViewDuration non si somma: media pesata sulle visualizzazioni, ricalcolata sui totali
    if (names.includes('averageViewDuration') && totals.views > 0 && totals.estimatedMinutesWatched !== undefined) {
        totals.averageViewDuration = Math.round((totals.estimatedMinutesWatched * 60) / totals.views);
    }
    return totals;
}

/** Estrae titolo e statistiche dal primo canale della risposta di YOUTUBE_GET_CHANNEL_STATISTICS. */
export function channelFromResponse(data: unknown): { id?: string; title?: string; subscribers: number; views: number; videos: number } | null {
    const o = asObject(data);
    const items = o?.items ?? o?.data?.items ?? o?.channels ?? (Array.isArray(o) ? o : null);
    const item = Array.isArray(items) ? items[0] : null;
    if (!item) return null;
    const stats = item.statistics || {};
    return {
        id: item.id,
        title: item.snippet?.title,
        // Le statistiche tornano come stringhe: cast difensivo
        subscribers: Number(stats.subscriberCount ?? 0),
        views: Number(stats.viewCount ?? 0),
        videos: Number(stats.videoCount ?? 0),
    };
}

export async function getYouTubeSummaryViaComposio(userId: string, startDate: string, endDate: string) {
    const [channelRes, analyticsRes] = await Promise.all([
        composioExecute(TOOLKIT, 'YOUTUBE_GET_CHANNEL_STATISTICS', { mine: true, part: 'snippet,statistics' }, userId),
        composioExecute(TOOLKIT, 'YOUTUBE_QUERY_ANALYTICS', {
            ids: 'channel==MINE', startDate, endDate, metrics: ANALYTICS_METRICS,
        }, userId),
    ]);
    return {
        channel: channelFromResponse(channelRes.data),
        period: analyticsTotals(analyticsRes.data),
    };
}
