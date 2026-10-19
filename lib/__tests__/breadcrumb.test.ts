import { describe, it, expect } from 'vitest';
import { segmentLabel } from '../breadcrumb';

const labels = { clients: 'Clienti', 'meta-ads': 'Meta Ads' };
const clients = { ZJHHBZm8Gn1ZDXBzU0Ha: { name: 'City Motors by Sarco' } };

describe('segmentLabel', () => {
    it('dopo /clients/ mostra il nome del cliente, non l\'ID', () => {
        expect(segmentLabel('ZJHHBZm8Gn1ZDXBzU0Ha', 'clients', clients, labels)).toBe('City Motors by Sarco');
    });

    it('elenco non ancora caricato: etichetta neutra al posto del codice', () => {
        expect(segmentLabel('ZJHHBZm8Gn1ZDXBzU0Ha', 'clients', {}, labels)).toBe('Cliente');
    });

    it('gli altri segmenti usano le etichette note o il testo leggibile', () => {
        expect(segmentLabel('meta-ads', 'ZJHHBZm8Gn1ZDXBzU0Ha', clients, labels)).toBe('Meta Ads');
        expect(segmentLabel('editorial-plan', 'x', clients, labels)).toBe('editorial plan');
        expect(segmentLabel('clients', undefined, clients, labels)).toBe('Clienti');
    });

    it('un ID non cliente (altra sezione) non viene scambiato per un cliente', () => {
        expect(segmentLabel('ZJHHBZm8Gn1ZDXBzU0Ha', 'projects', clients, labels)).toBe('ZJHHBZm8Gn1ZDXBzU0Ha');
    });
});
