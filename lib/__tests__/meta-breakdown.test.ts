import { describe, it, expect } from 'vitest';
import { pickConversionBasis, actionValue, byAd, byAgeGender, byRegion } from '../meta-breakdown';

describe('meta-breakdown', () => {
    it('sceglie gli acquisti se ci sono, altrimenti l\'azione più numerosa', () => {
        expect(pickConversionBasis([{ actions_lead: 50, actions_omni_purchase: 1 }])).toBe('actions_omni_purchase');
        expect(pickConversionBasis([{ actions_lead: 9, actions_add_to_cart: 267 }])).toBe('actions_add_to_cart');
        expect(pickConversionBasis([{ spend: 5 }])).toBeNull();
    });

    it('per zona usa l\'alias dei lead quando actions_lead è 0 (caso reale City Motors)', () => {
        const rows = [{ region: 'Lombardia', spend: 402.98, actions_lead: 0, actions_onsite_conversion_lead_grouped: 51 }];
        expect(actionValue(rows[0], 'actions_lead')).toBe(51);
        expect(pickConversionBasis(rows)).toBe('actions_lead');
        expect(byRegion(rows, 'actions_lead')[0].conversions).toBe(51);
    });

    it('per annuncio: ricalcola dai totali e il costo senza conversioni è null, non 0', () => {
        const rows = [
            { ad_id: '1', ad_name: 'A', campaign: 'C', spend: 86, impressions: 19067, clicks: 373, reach: 6608, actions_lead: 9 },
            { ad_id: '2', ad_name: 'B', campaign: 'C', spend: 10, impressions: 100, clicks: 0, reach: 0 },
        ];
        const out = byAd(rows, 'actions_lead');
        expect(out.map((r) => r.label)).toEqual(['A', 'B']);
        expect(out[0]).toMatchObject({ ctr: 1.96, cpc: 0.23, frequency: 2.89, costPerConversion: 9.56, detail: 'C' });
        expect(out[1]).toMatchObject({ ctr: 0, cpc: null, frequency: null, conversions: 0, costPerConversion: null });
    });

    it('somma le righe dello stesso annuncio', () => {
        const rows = [
            { ad_id: '1', ad_name: 'A', spend: 1, impressions: 10, clicks: 1, actions_lead: 1 },
            { ad_id: '1', ad_name: 'A', spend: 3, impressions: 30, clicks: 1, actions_lead: 1 },
        ];
        expect(byAd(rows, 'actions_lead')[0]).toMatchObject({ spend: 4, impressions: 40, clicks: 2, conversions: 2, costPerConversion: 2 });
    });

    it('età sconosciuta: «Non indicata», e le righe vuote spariscono', () => {
        const out = byAgeGender([{ age: 'Unknown', gender: 'unknown', spend: 0, impressions: 0 }, { age: 'Unknown', gender: 'male', spend: 0.01, impressions: 2 }], null);
        expect(out.map((r) => `${r.label} ${r.detail}`)).toEqual(['Non indicata Uomini']);
    });

    it('età e genere: ordine per età poi genere, etichette italiane', () => {
        const rows = [
            { age: '25-34', gender: 'male', spend: 1 },
            { age: '18-24', gender: 'unknown', spend: 1 },
            { age: '18-24', gender: 'female', spend: 1 },
            { age: '65+', gender: 'female', spend: 1 },
        ];
        expect(byAgeGender(rows, null).map((r) => `${r.label} ${r.detail}`)).toEqual([
            '18-24 Donne', '18-24 Non specificato', '25-34 Uomini', '65+ Donne',
        ]);
    });
});
