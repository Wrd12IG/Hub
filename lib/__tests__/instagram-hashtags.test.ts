import { describe, it, expect } from 'vitest';
import { extractHashtags, aggregateHashtags, postsPerDay } from '../instagram-hashtags';

describe('instagram-hashtags', () => {
    it('estrae gli hashtag senza doppioni, minuscoli, con lettere accentate', () => {
        expect(extractHashtags('Nuova Yaris Cross 🔥 #Toyota #YarisCross #toyota #città_2026 #2026 e basta')).toEqual(['#toyota', '#yariscross', '#città_2026']);
        expect(extractHashtags(undefined)).toEqual([]);
        expect(extractHashtags('nessun hashtag, solo # e #a')).toEqual([]);
    });

    it('aggrega per hashtag: post, viste, mi piace e commenti, ordinati per viste', () => {
        const rows = aggregateHashtags([
            { media_caption: 'A #toyota #hilux', media_views: 2000, media_like_count: 30, media_comments_count: 1 },
            { media_caption: 'B #toyota', media_views: 500, media_like_count: 10, media_comments_count: 2 },
            { media_caption: 'senza tag', media_views: 9999 },
        ]);
        expect(rows).toEqual([
            { parola: '#toyota', viste: 2500, post: 2, miPiace: 40, commenti: 3 },
            { parola: '#hilux', viste: 2000, post: 1, miPiace: 30, commenti: 1 },
        ]);
    });

    it('nessun contenuto: nessuna riga', () => {
        expect(aggregateHashtags([])).toEqual([]);
    });

    it('conta i contenuti per giorno dal timestamp', () => {
        expect(postsPerDay([
            { timestamp: '2026-09-21T15:05:57+0000' }, { timestamp: '2026-09-21T18:00:00+0000' },
            { timestamp: '2026-10-13T07:03:49+0000' }, { timestamp: 'boh' }, {},
        ])).toEqual({ '2026-09-21': 2, '2026-10-13': 1 });
    });
});
