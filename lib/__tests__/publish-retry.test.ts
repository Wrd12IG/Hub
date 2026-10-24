import { describe, it, expect } from 'vitest';
import { executeWithRetry, isMediaNotReadyError, RETRY_DELAYS_MS } from '../publish-retry';

const NOT_READY = new Error('Azione create_story su instagram fallita (HTTP 400): {"error":"Instagram write action failed for account 1784: Media ID is not available"}');

describe('isMediaNotReadyError', () => {
    it('riconosce l\'errore transitorio di Instagram, in più forme', () => {
        expect(isMediaNotReadyError(NOT_READY.message)).toBe(true);
        expect(isMediaNotReadyError('The media is not ready for publishing, please wait for a moment')).toBe(true);
        expect(isMediaNotReadyError('error_subcode 2207027')).toBe(true);
    });
    it('non scambia altri errori per transitori', () => {
        expect(isMediaNotReadyError('Invalid OAuth access token')).toBe(false);
        expect(isMediaNotReadyError('HTTP 401')).toBe(false);
        expect(isMediaNotReadyError('')).toBe(false);
        expect(isMediaNotReadyError(undefined)).toBe(false);
    });
});

describe('executeWithRetry', () => {
    const fast = { sleep: async () => {} };
    it('riesce al primo tentativo senza attese', async () => {
        let waits = 0;
        const r = await executeWithRetry(async () => 'ok', { sleep: async () => { waits++; } });
        expect(r).toBe('ok');
        expect(waits).toBe(0);
    });
    it('riprova dopo «Media ID is not available» e poi riesce (il caso vero del 24/10)', async () => {
        let calls = 0; const waited: number[] = [];
        const r = await executeWithRetry(async () => { if (++calls < 3) throw NOT_READY; return 'pubblicato'; }, { sleep: async (ms) => { waited.push(ms); } });
        expect(r).toBe('pubblicato');
        expect(calls).toBe(3);
        expect(waited).toEqual(RETRY_DELAYS_MS);
    });
    it('dopo i tentativi previsti smette e rilancia l\'errore', async () => {
        let calls = 0;
        await expect(executeWithRetry(async () => { calls++; throw NOT_READY; }, fast)).rejects.toThrow('Media ID is not available');
        expect(calls).toBe(RETRY_DELAYS_MS.length + 1);
    });
    it('un errore diverso fallisce subito, senza riprovare (niente rischio di doppi post)', async () => {
        let calls = 0;
        await expect(executeWithRetry(async () => { calls++; throw new Error('Invalid OAuth access token'); }, fast)).rejects.toThrow('OAuth');
        expect(calls).toBe(1);
    });
    it('canRetry=false: niente nuovi tentativi (fine del tempo a disposizione)', async () => {
        let calls = 0;
        await expect(executeWithRetry(async () => { calls++; throw NOT_READY; }, { ...fast, canRetry: () => false })).rejects.toThrow();
        expect(calls).toBe(1);
    });
    it('avvisa a ogni nuovo tentativo', async () => {
        const seen: number[] = [];
        let calls = 0;
        await executeWithRetry(async () => { if (++calls < 2) throw NOT_READY; return 1; }, { ...fast, onRetry: (n) => seen.push(n) });
        expect(seen).toEqual([1]);
    });
});
