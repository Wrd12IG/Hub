import { describe, it, expect } from 'vitest';
import { parseCount, parseLinkedinFollowers, summarizeYoutube } from '../competitor-social';

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
