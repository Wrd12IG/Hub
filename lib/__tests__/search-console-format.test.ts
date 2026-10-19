import { describe, it, expect } from 'vitest';
import { pagePath, ctrPct } from '../search-console-format';

describe('search console', () => {
    it('mostra il percorso, non l\'URL', () => {
        expect(pagePath('https://www.citymotors.it/')).toBe('/');
        expect(pagePath('https://www.citymotors.it/usato/yaris?x=1')).toBe('/usato/yaris?x=1');
        expect(pagePath('non-un-url')).toBe('non-un-url');
    });
    it('CTR da frazione a percentuale', () => {
        expect(ctrPct(0.0105)).toBe('1,05%');
    });
});
