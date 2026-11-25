import { describe, it, expect } from 'vitest';
import { clientHref } from '../client-nav';

describe('clientHref', () => {
    it('resta nella sezione scelta', () => {
        expect(clientHref('/clients/a/scheda', { id: 'b' })).toBe('/clients/b/scheda');
        expect(clientHref('/clients/a/site-monitor/', { id: 'b' })).toBe('/clients/b/site-monitor');
    });
    it('dalla panoramica o da fuori dei clienti apre la panoramica', () => {
        expect(clientHref('/clients/a', { id: 'b' })).toBe('/clients/b');
        expect(clientHref('/dashboard', { id: 'b' })).toBe('/clients/b');
    });
    it('non porta su pagine con id annidati o sconosciute', () => {
        expect(clientHref('/clients/a/meta-ads/xyz/preview', { id: 'b' })).toBe('/clients/b');
        expect(clientHref('/clients/a/meta-ads', { id: 'b' })).toBe('/clients/b');
    });
    it('i KPI restano nella sezione con qualunque profilo del cliente di arrivo (la pagina vale per tutti)', () => {
        for (const kpiProfile of ['auto', 'locale', 'ecommerce', null, undefined]) {
            expect(clientHref('/clients/a/dealer-kpi', { id: 'b', kpiProfile }), String(kpiProfile)).toBe('/clients/b/dealer-kpi');
        }
    });
});
