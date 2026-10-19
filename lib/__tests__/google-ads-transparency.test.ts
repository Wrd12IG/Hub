import { describe, it, expect } from 'vitest';
import { patternsFor, buildQuery, parseRows, explainBigQueryError } from '../google-ads-transparency';

describe('google-ads-transparency', () => {
    it('modelli di ricerca da nome e dominio, senza accenti né simboli', () => {
        expect(patternsFor({ id: 'a', nome: 'Spotorno Car', sito: 'https://www.spotornocar.it/' })).toEqual(['spotorno car', 'spotornocar']);
        expect(patternsFor({ id: 'a', nome: 'Auto Più & Co', sito: '' })).toEqual(['auto piu co']);
        expect(patternsFor({ id: 'a', nome: 'XY' })).toEqual([]);
    });

    it('la query ha una riga per modello, filtra Italia e non lascia passare apici', () => {
        const q = buildQuery([{ id: "a'b", nome: "Finiguerra", sito: 'finiguerra.it' }], '2026-09-19');
        expect(q).toContain("'ab' AS k, '%finiguerra%' AS pattern");
        expect(q).toContain("rs.region_code = 'IT' AND c.advertiser_location = 'IT'");
        expect(q).toContain("rs.last_shown >= '2026-09-19'");
        expect(q).not.toContain("a'b");
        expect(() => buildQuery([{ id: 'x', nome: 'ab' }], '2026-09-19')).toThrow();
    });

    it('legge le righe di BigQuery per nome colonna', () => {
        const fields = ['competitor', 'advertiser_id', 'advertiser', 'creatives', 'recent', 'text_ads', 'image_ads', 'video_ads', 'first_shown', 'last_shown'].map((name) => ({ name }));
        const rows = [{ f: ['c1', 'AR1', 'FINIGUERRA SRL', '12', '3', '10', '2', '0', '2025-01-02', '2026-10-15'].map((v) => ({ v })) }];
        expect(parseRows(fields, rows)).toEqual([{
            competitorId: 'c1', advertiserId: 'AR1', advertiser: 'FINIGUERRA SRL', creatives: 12, recent: 3,
            formats: { text: 10, image: 2, video: 0 }, firstShown: '2025-01-02', lastShown: '2026-10-15',
        }]);
    });

    it('spiega il 403 con il ruolo da assegnare', () => {
        const msg = explainBigQueryError(403, 'Access Denied: User does not have bigquery.jobs.create permission', 'hubwrdigital', 'sa@hubwrdigital.iam.gserviceaccount.com');
        expect(msg).toContain('Utente job BigQuery');
        expect(msg).toContain('sa@hubwrdigital.iam.gserviceaccount.com');
    });
});
