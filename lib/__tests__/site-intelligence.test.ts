import { describe, it, expect } from 'vitest';
import { assertPublicHttpUrl, htmlToText, normalizeIntelligence, parseModelJson } from '../site-intelligence';

describe('site-intelligence', () => {
    it('accetta host pubblici e aggiunge https', () => {
        expect(assertPublicHttpUrl('www.citymotors.it').href).toBe('https://www.citymotors.it/');
        expect(assertPublicHttpUrl('http://esempio.it/pagina').protocol).toBe('http:');
    });

    it('rifiuta rete interna, localhost, IP privati, IPv6 e protocolli strani', () => {
        for (const bad of ['http://localhost:3000', 'http://127.0.0.1', 'http://10.0.0.5', 'http://192.168.1.1', 'http://172.20.0.1',
            'http://169.254.169.254/latest', 'http://[::1]/', 'http://intranet', 'https://server.internal', 'file:///etc/passwd', '']) {
            expect(() => assertPublicHttpUrl(bad), bad).toThrow();
        }
    });

    it('htmlToText toglie script/stile/tag, tiene titolo e descrizione, rispetta il limite', () => {
        const html = '<html><head><title>City Motors</title><meta name="description" content="Toyota a Monza"><style>a{}</style></head><body><script>x()</script><h1>Toyota &amp; Lexus</h1><p>Vendita&nbsp;auto</p></body></html>';
        const t = htmlToText(html);
        expect(t).toContain('Titolo: City Motors');
        expect(t).toContain('Descrizione: Toyota a Monza');
        expect(t).toContain('Toyota & Lexus Vendita auto');
        expect(t).not.toContain('x()');
        expect(htmlToText('<p>' + 'a'.repeat(50000) + '</p>', 100).length).toBe(100);
    });

    it('normalizza un JSON sporco nello schema della scheda (array sempre array, numeri in range)', () => {
        const n = normalizeIntelligence({
            productDescription: ' Auto Toyota ', targetAgeMin: '25', targetAgeMax: 400, confidenceScore: 150,
            targetPainPoints: 'non è un array', targetTriggers: ['rottamazione', null, ''],
            competitors: [{ name: 'Rivale' }, { url: 'senza nome' }, null], priceRange: '',
        });
        expect(n.productDescription).toBe('Auto Toyota');
        expect(n.targetAgeMin).toBe(25);
        expect(n.targetAgeMax).toBe(100);
        expect(n.confidenceScore).toBe(100);
        expect(n.targetPainPoints).toEqual([]);
        expect(n.targetTriggers).toEqual(['rottamazione']);
        expect(n.competitors).toEqual([{ name: 'Rivale', url: undefined, estimatedBudget: undefined, notes: undefined }]);
        expect(n.priceRange).toBeNull();
        expect(n.websiteScraped).toBe(true);
        expect(normalizeIntelligence(null).metaInterests).toEqual([]);
    });

    it('parseModelJson legge JSON con o senza recinto markdown e con testo intorno', () => {
        expect(parseModelJson('{"a":1}')).toEqual({ a: 1 });
        expect(parseModelJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
        expect(parseModelJson('Ecco: {"a":3} fine')).toEqual({ a: 3 });
        expect(() => parseModelJson('niente json')).toThrow();
    });
});
