import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateImage, extractImageDataUrl, NANO_BANANA_MODELS } from '../nano-banana';

const imageResponse = { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'x' }, { inlineData: { mimeType: 'image/png', data: 'AAA' } }] } }] }) } as any;
const fail = (message: string) => ({ ok: false, statusText: 'err', json: async () => ({ error: { message } }) }) as any;

describe('nano-banana', () => {
    let urls: string[];
    beforeEach(() => { process.env.GEMINI_API_KEY = 'key'; urls = []; });
    afterEach(() => vi.unstubAllGlobals());
    const stub = (...responses: any[]) => vi.stubGlobal('fetch', vi.fn(async (url: string) => { urls.push(url); return responses.shift(); }));

    it('estrae la prima immagine come data URL', () => {
        expect(extractImageDataUrl(imageResponse && { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: 'QQ' } }] } }] })).toBe('data:image/jpeg;base64,QQ');
        expect(extractImageDataUrl({})).toBeNull();
    });

    it('genera con il primo modello', async () => {
        stub(imageResponse);
        expect(await generateImage('p')).toBe('data:image/png;base64,AAA');
        expect(urls[0]).toContain(NANO_BANANA_MODELS[0]);
    });

    it('ripiega sul secondo modello se il primo fallisce', async () => {
        stub(fail('quota'), imageResponse);
        expect(await generateImage('p')).toContain('base64,AAA');
        expect(urls[1]).toContain(NANO_BANANA_MODELS[1]);
    });

    it('se falliscono tutti, l\'errore elenca ogni modello', async () => {
        stub(fail('quota'), fail('not found'));
        await expect(generateImage('p')).rejects.toThrow(/quota.*not found/);
    });

    it('senza chiave non chiama la rete', async () => {
        process.env.GEMINI_API_KEY = 'your_gemini_api_key';
        stub();
        await expect(generateImage('p')).rejects.toThrow('GEMINI_API_KEY');
        expect(urls).toHaveLength(0);
    });
});
