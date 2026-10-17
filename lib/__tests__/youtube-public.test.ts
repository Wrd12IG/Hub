import { describe, it, expect } from 'vitest';
import { parseChannelInput, channelFromItem, videoFromItem } from '../youtube-public';

describe('youtube-public', () => {
    it('riconosce ID canale, link /channel/ e @handle', () => {
        expect(parseChannelInput('UCeh0oV_lLDn4_80bip0ZEQQ')).toEqual({ channelId: 'UCeh0oV_lLDn4_80bip0ZEQQ' });
        expect(parseChannelInput(' https://www.youtube.com/channel/UCeh0oV_lLDn4_80bip0ZEQQ ')).toEqual({ channelId: 'UCeh0oV_lLDn4_80bip0ZEQQ' });
        expect(parseChannelInput('@ToyotaCityMotors-vs1gr')).toEqual({ handle: '@ToyotaCityMotors-vs1gr' });
        expect(parseChannelInput('https://youtube.com/@toyotacitymotors-vs1gr')).toEqual({ handle: '@toyotacitymotors-vs1gr' });
        expect(parseChannelInput('ciao')).toBeNull();
        expect(parseChannelInput('')).toBeNull();
        expect(parseChannelInput('UCtroppocorto')).toBeNull();
    });

    it('canale: statistiche come stringhe diventano numeri', () => {
        const c = channelFromItem({
            id: 'UC1', snippet: { title: 'City Motors by Sarco', customUrl: '@x' },
            statistics: { subscriberCount: '490', viewCount: '344339', videoCount: '88' },
            contentDetails: { relatedPlaylists: { uploads: 'UU1' } },
        });
        expect(c).toMatchObject({ id: 'UC1', title: 'City Motors by Sarco', subscribers: 490, views: 344339, videos: 88, uploadsPlaylistId: 'UU1', hiddenSubscribers: false });
        expect(channelFromItem(undefined)).toBeNull();
    });

    it('video: data senza orario e conteggi numerici (anche se mancano)', () => {
        const v = videoFromItem({ id: 'abc', snippet: { title: 'T', publishedAt: '2026-10-01T10:00:00Z' }, statistics: { viewCount: '1200' } });
        expect(v).toMatchObject({ id: 'abc', date: '2026-10-01', views: 1200, likes: 0, comments: 0, url: 'https://youtube.com/watch?v=abc' });
    });
});
