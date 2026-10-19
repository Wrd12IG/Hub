import { describe, it, expect } from 'vitest';
import { youtubePeriodStats, youtubeDailyRows } from '../youtube-report';

const videos = [
    { date: '2026-10-15T08:00:00Z', views: 1200 },
    { date: '2026-10-15T18:00:00Z', views: 300 },
    { date: '2026-10-02T08:00:00Z', views: 800 },
    { date: '2026-09-10T08:00:00Z', views: 5000 },
];
const range = { dateFrom: '2026-10-01', dateTo: '2026-10-19' };

describe('youtube-report', () => {
    it('conta i video del periodo e le loro visualizzazioni, non quelli fuori', () => {
        expect(youtubePeriodStats(videos, range)).toEqual({ period_videos: 3, period_views: 2300 });
        expect(youtubePeriodStats(videos, { dateFrom: '2026-09-01', dateTo: '2026-09-30' })).toEqual({ period_videos: 1, period_views: 5000 });
    });

    it('una riga per giorno di pubblicazione, ordinata; i giorni senza video non ci sono', () => {
        expect(youtubeDailyRows(videos, range)).toEqual([
            { date: '2026-10-02', video_views: 800, video_count: 1 },
            { date: '2026-10-15', video_views: 1500, video_count: 2 },
        ]);
    });

    it('periodo senza video: tutto a zero, nessuna riga', () => {
        expect(youtubePeriodStats(videos, { dateFrom: '2026-01-01', dateTo: '2026-01-31' })).toEqual({ period_videos: 0, period_views: 0 });
        expect(youtubeDailyRows([], range)).toEqual([]);
    });
});
