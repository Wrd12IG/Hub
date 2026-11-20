// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createFirecrawlClient, isPublicHttpUrl, type FetchLike, type FirecrawlClient } from '@/lib/site-monitor/firecrawl';
import { budgetFromEnv, DEFAULT_BUDGET, pagesAllowed } from '@/lib/site-monitor/budget';
import { scanSite, type ScanDeps } from '@/lib/site-monitor/scan';
import { memoryStore } from '@/lib/site-monitor/store';

const NOW = new Date('2026-11-20T10:00:00Z');
const WORDS = 'parola '.repeat(60);

describe('budget', () => {
    it('rispetta tetto mensile, riserva e massimo pagine', () => {
        expect(pagesAllowed(DEFAULT_BUDGET, 0, 5000)).toEqual({ pages: 25, reason: 'ok' });
        expect(pagesAllowed(DEFAULT_BUDGET, 490, 5000).pages).toBe(10);
        expect(pagesAllowed(DEFAULT_BUDGET, 0, 1510).pages).toBe(10);
        expect(pagesAllowed(DEFAULT_BUDGET, 500, 5000).reason).toBe('tetto_mensile');
        expect(pagesAllowed(DEFAULT_BUDGET, 0, 1500).reason).toBe('riserva');
        expect(pagesAllowed(DEFAULT_BUDGET, 0, null).reason).toBe('crediti_non_leggibili');
    });
    it('legge i valori da env con default sicuri', () => {
        expect(budgetFromEnv({})).toEqual(DEFAULT_BUDGET);
        expect(budgetFromEnv({ SITE_MONITOR_MONTHLY_CREDITS: 'abc', SITE_MONITOR_MAX_PAGES: '5' }).maxPages).toBe(5);
    });
});

describe('client Firecrawl', () => {
    it('non chiama la rete per indirizzi interni', async () => {
        const f = vi.fn();
        const c = createFirecrawlClient({ apiKey: 'k', fetchImpl: f as unknown as FetchLike });
        expect((await c.scrape('http://127.0.0.1/admin')).error).toBeTruthy();
        expect(f).not.toHaveBeenCalled();
        expect(isPublicHttpUrl('https://www.esempio.it/x')).toBe(true);
        expect(isPublicHttpUrl('http://192.168.1.5/')).toBe(false);
        expect(isPublicHttpUrl('file:///etc/passwd')).toBe(false);
    });
    it('legge pagina e crediti; 402 diventa errore riconoscibile', async () => {
        const ok: FetchLike = async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { rawHtml: '<p>x</p>', metadata: { statusCode: 404 } } }), text: async () => '' });
        const r = await createFirecrawlClient({ apiKey: 'k', fetchImpl: ok }).scrape('https://a.it/');
        expect(r).toMatchObject({ status: 404, credits: 1 });
        const no: FetchLike = async () => ({ ok: false, status: 402, json: async () => ({}), text: async () => '' });
        expect((await createFirecrawlClient({ apiKey: 'k', fetchImpl: no }).scrape('https://a.it/')).error).toBe('firecrawl_402');
    });
});

function setup(pages: Record<string, string>, remaining: number | null = 5000) {
    const scrape = vi.fn(async (url: string) => ({ url, status: pages[url] === undefined ? 404 : 200, html: pages[url] ?? '', credits: 1 }));
    const firecrawl: FirecrawlClient = { scrape, creditsRemaining: async () => remaining };
    const store = memoryStore();
    const deps: ScanDeps = {
        firecrawl, store, now: NOW, budget: DEFAULT_BUDGET,
        checkUrl: async (url) => ({ url, status: 200 }),
        fetchText: async (url) => (url.endsWith('sitemap.xml') ? '<urlset><url><loc>https://a.it/offerte</loc></url></urlset>' : null),
    };
    return { deps, scrape, store };
}
const HOME = `<p>${WORDS} © 2026</p>`;
const OFFERS = `<p>Offerta valida fino al 31/10/2025 ${WORDS}</p><img src="/x.jpg">`;

describe('scanSite', () => {
    it('trova problemi, salva e tiene il conto dei crediti', async () => {
        const { deps, store } = setup({ 'https://a.it/': HOME, 'https://a.it/offerte': OFFERS });
        const { scan, findings } = await scanSite('c1', 'https://a.it', deps);
        expect(scan).toMatchObject({ status: 'ok', pagesScanned: 2, creditsUsed: 2 });
        expect(findings.some((f) => f.type === 'expired_content')).toBe(true);
        expect((await store.getState('c1'))?.creditsUsed).toBe(2);
        expect(store.scans.get('c1')).toHaveLength(1);
    });
    it('seconda scansione: nessun doppione, problema sparito = risolto', async () => {
        const { deps, store } = setup({ 'https://a.it/': HOME, 'https://a.it/offerte': OFFERS });
        await scanSite('c1', 'https://a.it', deps);
        const n = (await store.getFindings('c1')).length;
        const again = await scanSite('c1', 'https://a.it', deps);
        expect(again.scan.findingsNew).toBe(0);
        expect((await store.getFindings('c1')).length).toBe(n);
        const fixed = setup({ 'https://a.it/': HOME, 'https://a.it/offerte': `<p>${WORDS}</p><img src="/x.jpg" alt="Auto">` });
        for (const f of await store.getFindings('c1')) await fixed.store.saveFindings('c1', [f]);
        const r = await scanSite('c1', 'https://a.it', fixed.deps);
        expect(r.scan.findingsResolved).toBeGreaterThan(0);
    });
    it('un problema ignorato resta ignorato', async () => {
        const { deps, store } = setup({ 'https://a.it/': HOME, 'https://a.it/offerte': OFFERS });
        await scanSite('c1', 'https://a.it', deps);
        const f = (await store.getFindings('c1'))[0];
        await store.saveFindings('c1', [{ ...f, status: 'ignorato' }]);
        await scanSite('c1', 'https://a.it', deps);
        expect((await store.getFindings('c1')).find((x) => x.fingerprint === f.fingerprint)?.status).toBe('ignorato');
    });
    it('budget esaurito: nessuna pagina letta', async () => {
        const { deps, scrape, store } = setup({}, 1400);
        const { scan } = await scanSite('c1', 'https://a.it', deps);
        expect(scan.status).toBe('budget_esaurito');
        expect(scrape).not.toHaveBeenCalled();
        expect(await store.getFindings('c1')).toEqual([]);
    });
    it('dry-run non scrive niente', async () => {
        const { deps, store } = setup({ 'https://a.it/': HOME, 'https://a.it/offerte': OFFERS });
        await scanSite('c1', 'https://a.it', { ...deps, dryRun: true });
        expect(await store.getState('c1')).toBeNull();
        expect(await store.getFindings('c1')).toEqual([]);
    });
    it('il tetto pagine limita la scansione e non dichiara risolto nulla', async () => {
        const { deps } = setup({ 'https://a.it/': HOME, 'https://a.it/offerte': OFFERS });
        const r = await scanSite('c1', 'https://a.it', { ...deps, budget: { ...DEFAULT_BUDGET, maxPages: 1 } });
        expect(r.scan).toMatchObject({ status: 'parziale', pagesScanned: 1, findingsResolved: 0 });
    });
    it('rifiuta un sito con indirizzo interno', async () => {
        const { deps, scrape } = setup({});
        expect((await scanSite('c1', 'http://localhost:3000', deps)).scan.status).toBe('errore');
        expect(scrape).not.toHaveBeenCalled();
    });
});
