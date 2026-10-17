import { describe, it, expect } from 'vitest';
import { analyticsTotals, channelFromResponse } from '../youtube-composio';

const table = {
    columnHeaders: [{ name: 'day' }, { name: 'views' }, { name: 'estimatedMinutesWatched' }, { name: 'averageViewDuration' }],
    rows: [['2026-10-01', 100, 50, 30], ['2026-10-02', 300, 250, 50]],
};

describe('youtube-composio', () => {
    it('somma le righe e ricalcola la durata media sui totali', () => {
        const t = analyticsTotals(table);
        expect(t.views).toBe(400);
        expect(t.estimatedMinutesWatched).toBe(300);
        expect(t.averageViewDuration).toBe(45); // 300 min * 60 / 400 visualizzazioni
    });

    it('trova la tabella anche in una stringa JSON o annidata in data', () => {
        expect(analyticsTotals(JSON.stringify({ data: table })).views).toBe(400);
        expect(analyticsTotals({ response_data: table }).views).toBe(400);
        expect(analyticsTotals(null)).toEqual({});
        expect(analyticsTotals('non json')).toEqual({});
    });

    it('canale: statistiche come stringhe diventano numeri', () => {
        const c = channelFromResponse({ items: [{ id: 'UC1', snippet: { title: 'WR' }, statistics: { subscriberCount: '1200', viewCount: '98000', videoCount: '34' } }] });
        expect(c).toEqual({ id: 'UC1', title: 'WR', subscribers: 1200, views: 98000, videos: 34 });
        expect(channelFromResponse({ items: [] })).toBeNull();
    });
});
