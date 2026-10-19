// YouTube nel report, dai dati PUBBLICI (API con chiave, nessun accesso al canale): totali del canale e, per il periodo,
// i video pubblicati e le loro visualizzazioni. L'andamento giornaliero delle visualizzazioni del canale richiederebbe
// YouTube Analytics (autorizzazione del proprietario): qui le visualizzazioni stanno nel giorno in cui il video è uscito.

export interface VideoLike { date: string; views: number }
export interface Range { dateFrom: string; dateTo: string }

const dayOf = (iso: string) => String(iso).slice(0, 10);
const inRange = (v: VideoLike, r: Range) => dayOf(v.date) >= r.dateFrom && dayOf(v.date) <= r.dateTo;

/** Quanti video sono usciti nel periodo e quante visualizzazioni hanno (visualizzazioni di sempre, di quei video). */
export function youtubePeriodStats(videos: VideoLike[], range: Range) {
    const inPeriod = videos.filter((v) => inRange(v, range));
    return { period_videos: inPeriod.length, period_views: inPeriod.reduce((s, v) => s + (v.views || 0), 0) };
}

/** Una riga per giorno di pubblicazione: i giorni senza uscite non compaiono (non c'è un dato da mostrare). */
export function youtubeDailyRows(videos: VideoLike[], range: Range): ({ date: string; video_views: number; video_count: number })[] {
    const byDay = new Map<string, { date: string; video_views: number; video_count: number }>();
    for (const v of videos) {
        if (!inRange(v, range)) continue;
        const d = dayOf(v.date);
        const row = byDay.get(d) ?? { date: d, video_views: 0, video_count: 0 };
        row.video_views += v.views || 0;
        row.video_count += 1;
        byDay.set(d, row);
    }
    return Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));
}
