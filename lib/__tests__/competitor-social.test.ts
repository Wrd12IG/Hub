import { describe, it, expect } from 'vitest';
import { parseCount, parseLinkedinFollowers, summarizeYoutube, parseInstagramDiscovery, explainGraphError, readCompetitorSocial } from '../competitor-social';

const NOW = new Date('2026-10-19T12:00:00Z');
const channel = { id: 'UC1', title: 'Spotorno Car', subscribers: 12300, views: 900000, videos: 154, hiddenSubscribers: false, uploadsPlaylistId: 'UU1' };
const video = (date: string) => ({ id: date, title: 't', date, thumbnail: '', url: '', views: 0, likes: 0, comments: 0, duration: '' });

describe('competitor-social', () => {
    it('legge i numeri con separatore delle migliaia, non indovina il resto', () => {
        expect(parseCount('142,628')).toBe(142628);
        expect(parseCount('142.628')).toBe(142628);
        expect(parseCount('980')).toBe(980);
        expect(parseCount('1,2 K')).toBeNull();
        expect(parseCount('')).toBeNull();
    });

    it('follower dalla descrizione della pagina LinkedIn, in inglese e in italiano', () => {
        const en = '<meta property="og:description" content="Toyota Motor Europe | 142,628 followers on LinkedIn. At Toyota…">';
        const it = '<meta property="og:description" content="Autotorino | 18.250 follower su LinkedIn.">';
        expect(parseLinkedinFollowers(en)).toBe(142628);
        expect(parseLinkedinFollowers(it)).toBe(18250);
        expect(parseLinkedinFollowers('<html>niente</html>')).toBeNull();
    });

    it('YouTube: ultimo caricamento e quanti negli ultimi 30 giorni', () => {
        const s = summarizeYoutube(channel, [video('2026-10-15T08:00:00Z'), video('2026-10-02T08:00:00Z'), video('2026-08-01T08:00:00Z')], NOW);
        expect(s).toMatchObject({ subscribers: 12300, videos: 154, lastUpload: '2026-10-15', uploadsLast30d: 2, uploadsCapped: false });
    });

    it('iscritti nascosti: nessun numero inventato', () => {
        expect(summarizeYoutube({ ...channel, hiddenSubscribers: true }, [], NOW).subscribers).toBeNull();
        expect(summarizeYoutube(channel, [], NOW).lastUpload).toBeNull();
    });

    it('quindici video tutti dell\'ultimo mese: il conteggio è un minimo', () => {
        const many = Array.from({ length: 15 }, (_, i) => video(`2026-10-${String(1 + (i % 18)).padStart(2, '0')}T08:00:00Z`));
        expect(summarizeYoutube(channel, many, NOW)).toMatchObject({ uploadsLast30d: 15, uploadsCapped: true });
    });
});

describe('Instagram (Business Discovery)', () => {
    const media = (ts: string, likes?: number, comments?: number) => ({ timestamp: ts, like_count: likes, comments_count: comments });
    const resp = (data: any[]) => ({ business_discovery: { username: 'spotornocar', followers_count: 2000, media_count: 340, media: { data } } });

    it('follower, post del mese, ultimo post e interazioni medie', () => {
        const s = parseInstagramDiscovery(resp([media('2026-10-15T08:00:00+0000', 80, 20), media('2026-10-02T08:00:00+0000', 40, 10), media('2026-08-01T08:00:00+0000', 30, 0)]), NOW);
        expect(s).toMatchObject({ username: 'spotornocar', followers: 2000, posts: 340, lastPost: '2026-10-15', postsLast30d: 2, postsCapped: false });
        expect(s).toMatchObject({ avgInteractions: 60, engagementPct: 3 }); // (100+50+30)/3
    });

    it('mi piace nascosti: nessuna media inventata', () => {
        const s = parseInstagramDiscovery(resp([media('2026-10-15T08:00:00+0000')]), NOW);
        expect(s).toMatchObject({ avgInteractions: null, engagementPct: null });
    });

    it('risposta senza dati del profilo: errore, non zeri', () => {
        expect(parseInstagramDiscovery({}, NOW)).toEqual({ error: expect.any(String) });
    });

    it('errori di Meta riscritti in italiano, senza token', () => {
        expect(explainGraphError({ code: 190, message: 'Invalid OAuth access token.' }, 'Instagram')).toContain('scaduto');
        expect(explainGraphError({ code: 110, message: 'Invalid user id' }, 'Instagram')).toContain('Business o Creator');
        expect(explainGraphError({ code: 10, message: 'Application does not have permission for this action' }, 'Facebook')).toContain('Page Public Content Access');
    });
});

describe('readCompetitorSocial senza accesso a Meta', () => {
    it('Instagram e Facebook restano collegamenti, TikTok sempre', async () => {
        const [r] = await readCompetitorSocial([{ id: 'a', instagram: 'https://www.instagram.com/x/', facebook: 'https://www.facebook.com/x', tiktok: 'https://www.tiktok.com/@x' }]);
        expect(r.unreadable).toEqual(['instagram', 'facebook', 'tiktok']);
        expect(r.instagram).toBeUndefined();
    });
    it('con il token ma senza account Instagram del cliente: solo Instagram resta collegamento', async () => {
        const [r] = await readCompetitorSocial([{ id: 'a', instagram: 'https://www.instagram.com/x/', tiktok: 'https://www.tiktok.com/@x' }], { token: 't' });
        expect(r.unreadable).toEqual(['instagram', 'tiktok']);
    });
});
