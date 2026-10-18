import { describe, it, expect } from 'vitest';
import { buildGbpReport, sediFromRows, summarizeReviews, starToNumber } from '../gbp-report';

// Dati di City Motors del 17/10/2026: una sede con 17 recensioni nel periodo, una con 3, una con 0
const reviewRows = [
    ...Array.from({ length: 17 }, (_, i) => ({ account_id: 'locations/A', review_reviewer: `R${i}`, review_comment: 'ok', review_star_rating: 'FIVE', review_create_time: '2026-10-01T10:00:00Z', review_reply_comment: i < 10 ? 'grazie' : '', review_total_count: 245, review_average_rating_total: 4.9 })),
    ...Array.from({ length: 3 }, (_, i) => ({ account_id: 'locations/B', review_reviewer: `S${i}`, review_comment: 'ok', review_star_rating: 'FOUR', review_create_time: '2026-10-02T10:00:00Z', review_total_count: 121, review_average_rating_total: 4.5 })),
];
const sediRows = [
    { account_id: 'locations/A', account_name: 'Hub', review_total_count: 245, review_average_rating_total: 4.9 },
    { account_id: 'locations/B', account_name: 'Toyota 1', review_total_count: 121, review_average_rating_total: 4.5 },
    { account_id: 'locations/C', account_name: 'Toyota 2', review_total_count: 236, review_average_rating_total: 4.3 },   // 0 recensioni nel periodo
    { account_id: 'locations/D', account_name: 'Officina', review_total_count: 0, review_average_rating_total: null },
];

describe('gbp-report', () => {
    it('totale recensioni: una volta per sede, non una volta per riga (prima 4.528, ora 602)', () => {
        const sedi = sediFromRows(sediRows);
        expect(summarizeReviews(sedi).totale).toBe(602);
        // il vecchio calcolo, per documentare l'errore
        const vecchio = reviewRows.reduce((s, r) => s + r.review_total_count, 0);
        expect(vecchio).toBe(17 * 245 + 3 * 121);
    });

    it('voto medio pesato sulle recensioni di ogni sede; sedi senza voto ignorate', () => {
        const { valutazione } = summarizeReviews(sediFromRows(sediRows));
        expect(valutazione).toBe(4.6); // (245*4.9 + 121*4.5 + 236*4.3) / 602
        expect(summarizeReviews([])).toEqual({ totale: 0, valutazione: 0 });
    });

    it('le sedi senza recensioni nel periodo restano nell\'elenco', () => {
        const sedi = sediFromRows(sediRows);
        expect(sedi.map(s => s.nome)).toEqual(['Hub', 'Toyota 1', 'Toyota 2', 'Officina']);
        expect(sedi[3].valutazione).toBeNull();
    });

    it('report: recensioni del periodo, senza risposta, nome sede, serie giornaliere sommate fra sedi', () => {
        const r = buildGbpReport({
            daily: [
                { account_id: 'locations/A', date: '2026-10-01', impressions_desktop_maps: 10, impressions_mobile_search: 5, website_clicks: 2, call_clicks: 1, direction_requests: 3 },
                { account_id: 'locations/B', date: '2026-10-01', impressions_mobile_maps: 20, website_clicks: 1 },
            ],
            reviewRows, keywordRows: [
                { search_keyword: 'toyota monza', search_keyword_value: 10 },
                { search_keyword: 'toyota monza', search_keyword_value: 0, search_keyword_threshold: 15 },
                { search_keyword: 'yaris', search_keyword_value: 4 },
            ],
            sedi: sediFromRows(sediRows), days: 30,
        });
        expect(r.recensioniSummary).toEqual({ totale: 602, valutazione: 4.6, nelPeriodo: 20, senzaRisposta: 7 + 3 });
        expect(r.coperturaChart).toEqual([{ date: '2026-10-01', googleMaps: 30, ricercaGoogle: 5, totale: 35 }]);
        expect(r.clicSummary).toEqual({ sitoWeb: 3, telefono: 1, indirizzo: 3, totale: 7 });
        expect(r.paroleChiave[0]).toEqual({ parola: 'toyota monza', impression: 25 });
        expect(r.recensioni[0].sede).toBe('Toyota 1'); // la più recente
        expect(r.locations).toBe(4);
    });

    it('starToNumber', () => {
        expect(starToNumber('FIVE')).toBe(5);
        expect(starToNumber('3')).toBe(3);
        expect(starToNumber(undefined)).toBe(0);
    });
});
