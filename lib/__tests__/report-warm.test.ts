import { describe, it, expect } from 'vitest';
import { hasReportSources, needsWarming, progressPercent, sourcesSignature } from '../report-warm';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-10-20T03:00:00Z');

describe('report-warm', () => {
    it('un cliente senza fonti non si legge', () => {
        expect(hasReportSources({})).toBe(false);
        expect(hasReportSources({ windsorAccounts: { gbp: [] } })).toBe(false);
        expect(hasReportSources({ metaAdAccountId: '123' })).toBe(true);
        expect(hasReportSources({ windsorAccounts: { gbp: ['a'] } })).toBe(true);
        expect(hasReportSources({ windsorAccounts: { facebook_page: '323377684482' } })).toBe(true);
        expect(hasReportSources({ windsorAccounts: { searchconsole: 'https://x.it/' } })).toBe(true);
    });

    it('da riscaldare: manca, vecchio, o calcolato con un errore', () => {
        expect(needsWarming(null, NOW, 20 * HOUR)).toBe(true);
        expect(needsWarming({ computedAt: new Date(NOW - 2 * HOUR).toISOString(), ttlMs: 6 * HOUR }, NOW, 20 * HOUR)).toBe(false);
        expect(needsWarming({ computedAt: new Date(NOW - 21 * HOUR).toISOString(), ttlMs: 6 * HOUR }, NOW, 20 * HOUR)).toBe(true);
        expect(needsWarming({ computedAt: new Date(NOW - 1 * HOUR).toISOString(), ttlMs: 2 * 60_000 }, NOW, 20 * HOUR)).toBe(true);
        expect(needsWarming({ computedAt: 'boh' }, NOW, 20 * HOUR)).toBe(true);
    });

    it('percentuale di avanzamento tra 0 e 100, sicura con zero fonti', () => {
        expect(progressPercent({ done: 3, total: 6 })).toBe(50);
        expect(progressPercent({ done: 9, total: 6 })).toBe(100);
        expect(progressPercent({ done: 0, total: 0 })).toBe(0);
        expect(progressPercent(null)).toBe(0);
    });
});

describe('impronta delle fonti', () => {
    const base = { metaAdAccountId: '210', ga4PropertyId: '266', windsorAccounts: { instagram: 'ig1', gbp: ['b', 'a'] } };
    it('cambia quando si abbina una pagina Facebook o un profilo LinkedIn', () => {
        const a = sourcesSignature(base);
        expect(sourcesSignature({ ...base, windsorAccounts: { ...base.windsorAccounts, facebook_page: '3233' } })).not.toBe(a);
        expect(sourcesSignature({ ...base, windsorAccounts: { ...base.windsorAccounts, linkedin_organic: '3459' } })).not.toBe(a);
    });
    it('non cambia con l\'ordine delle sedi né delle chiavi', () => {
        expect(sourcesSignature(base)).toBe(sourcesSignature({ ...base, windsorAccounts: { gbp: ['a', 'b'], instagram: 'ig1' } }));
    });
    it('una copia senza impronta o con impronta diversa va rifatta, anche se è fresca', () => {
        const sig = sourcesSignature(base);
        const fresh = { computedAt: new Date(NOW - 5 * 60_000).toISOString() };
        expect(needsWarming(fresh, NOW, 20 * HOUR, sig)).toBe(true);
        expect(needsWarming({ ...fresh, sig: 'altra' }, NOW, 20 * HOUR, sig)).toBe(true);
        expect(needsWarming({ ...fresh, sig }, NOW, 20 * HOUR, sig)).toBe(false);
    });
});
