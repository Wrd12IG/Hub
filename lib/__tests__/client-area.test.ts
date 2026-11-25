import { describe, it, expect } from 'vitest';
import { isClientAreaPath } from '../client-area';

describe('isClientAreaPath', () => {
    it('i risultati, il PED e i brief del proprio cliente sono consentiti', () => {
        expect(isClientAreaPath('/clients/a', 'a')).toBe(true);
        expect(isClientAreaPath('/clients/a/', 'a')).toBe(true);
        expect(isClientAreaPath('/clients/a/editorial-plan', 'a')).toBe(true);
        expect(isClientAreaPath('/clients/a/briefs', 'a')).toBe(true);
        expect(isClientAreaPath('/clients/a/briefs/', 'a')).toBe(true);
    });
    it('le pagine interne dello staff non lo sono', () => {
        expect(isClientAreaPath('/clients/a/ped-plan', 'a')).toBe(false);
        expect(isClientAreaPath('/clients/a/facebook', 'a')).toBe(false);
        expect(isClientAreaPath('/clients/a/meta-ads/new', 'a')).toBe(false);
        expect(isClientAreaPath('/briefs', 'a')).toBe(false);
        expect(isClientAreaPath('/dashboard', 'a')).toBe(false);
    });
    it('un altro cliente non è consentito', () => {
        expect(isClientAreaPath('/clients/b', 'a')).toBe(false);
        expect(isClientAreaPath('/clients/b/editorial-plan', 'a')).toBe(false);
        expect(isClientAreaPath('/clients/ab/briefs', 'a')).toBe(false);
    });
});
