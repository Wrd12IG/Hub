/**
 * lib/site-monitor/scan.ts
 *
 * Una scansione di un sito cliente. Tutto ciò che tocca l'esterno entra da `deps` (Firecrawl, controlli diretti, sitemap, archivio):
 * nei test sono finti. Sola lettura sul sito del cliente. Nessun task e nessuna notifica da qui: i task si creano a parte.
 */
import { analyzePage, dedupeSiteWide } from './analyze';
import { pagesAllowed, monthKey, type BudgetConfig } from './budget';
import { classifyImageCheck, classifyLinkCheck } from './checks';
import { fingerprint, canonicalUrl } from './fingerprint';
import { isPublicHttpUrl, type FirecrawlClient } from './firecrawl';
import { parseSitemap, staleSitemapFinding } from './sitemap';
import type { FindingRecord, ScanRecord, SiteMonitorStore } from './store';
import type { Finding, ImageRef, UrlCheck } from './types';

export interface ScanDeps {
    firecrawl: FirecrawlClient;
    store: SiteMonitorStore;
    /** Controllo diretto (gratuito, non usa Firecrawl) di un indirizzo: stato, rimandi, peso. */
    checkUrl: (url: string) => Promise<UrlCheck>;
    /** Testo di un file semplice (sitemap). `null` se non c'è. */
    fetchText: (url: string) => Promise<string | null>;
    budget: BudgetConfig;
    now: Date;
    /** true = non scrive niente. I crediti dell'analisi vengono comunque spesi. */
    dryRun?: boolean;
}

export const MAX_LINK_CHECKS = 40;
export const MAX_IMAGE_CHECKS = 40;

export interface ScanResult { scan: ScanRecord; findings: FindingRecord[] }

const sameHost = (a: string, b: string) => new URL(canonicalUrl(a)).host === new URL(canonicalUrl(b)).host;

export async function scanSite(clientId: string, siteUrl: string, deps: ScanDeps): Promise<ScanResult> {
    const { firecrawl, store, now } = deps;
    const startedAt = now.toISOString();
    const id = `${startedAt.replace(/[-:.TZ]/g, '').slice(0, 14)}`;
    const base: ScanRecord = { id, startedAt, status: 'ok', pagesScanned: 0, creditsUsed: 0, findingsNew: 0, findingsOpen: 0, findingsResolved: 0 };
    const finish = async (scan: ScanRecord, findings: FindingRecord[]) => ({ scan, findings });

    if (!isPublicHttpUrl(siteUrl)) return finish({ ...base, status: 'errore', note: 'indirizzo del sito non valido' }, []);
    const origin = new URL(siteUrl).origin;

    // 1. Budget
    const month = monthKey(now);
    const state = await store.getState(clientId);
    const spent = state && state.month === month ? state.creditsUsed : 0;
    const allowed = pagesAllowed(deps.budget, spent, await firecrawl.creditsRemaining());
    if (allowed.pages < 1) {
        const rec = { ...base, status: 'budget_esaurito' as const, note: allowed.reason };
        if (!deps.dryRun) await store.saveScan(clientId, rec);
        return finish(rec, []);
    }

    // 2. Quali pagine: la home e quelle della sitemap (stesso sito), nell'ordine, fino al limite
    const sitemapUrl = `${origin}/sitemap.xml`;
    const xml = await deps.fetchText(sitemapUrl);
    const info = xml ? parseSitemap(xml) : { urls: [], sitemaps: [] };
    const queue: string[] = [];
    const seen = new Set<string>();
    for (const u of [origin + '/', ...info.urls.map((x) => x.loc)]) {
        if (!isPublicHttpUrl(u) || !sameHost(u, origin)) continue;
        const k = canonicalUrl(u);
        if (!seen.has(k)) { seen.add(k); queue.push(u); }
    }

    // 3. Lettura pagine con Firecrawl
    const found: Finding[] = [];
    const links = new Map<string, string>(); // indirizzo -> pagina da cui viene
    const images = new Map<string, string>();
    let credits = 0;
    let stopped = false;
    for (const url of queue.slice(0, allowed.pages)) {
        const page = await firecrawl.scrape(url);
        credits += page.credits;
        if (page.error?.startsWith('firecrawl_402') || page.error?.startsWith('firecrawl_429')) { stopped = true; break; }
        base.pagesScanned++;
        const a = analyzePage(page, now);
        found.push(...a.findings);
        for (const l of a.links) if (!links.has(l)) links.set(l, url);
        for (const i of a.images as ImageRef[]) if (!images.has(i.src)) images.set(i.src, url);
    }

    // 4. Controlli diretti gratuiti (limitati)
    for (const [l, from] of Array.from(links).slice(0, MAX_LINK_CHECKS)) {
        if (!isPublicHttpUrl(l)) continue;
        found.push(...classifyLinkCheck(await deps.checkUrl(l), from, sameHost(l, origin)));
    }
    for (const [src, from] of Array.from(images).slice(0, MAX_IMAGE_CHECKS)) {
        if (!isPublicHttpUrl(src)) continue;
        found.push(...classifyImageCheck(await deps.checkUrl(src), from));
    }
    const stale = staleSitemapFinding(info, sitemapUrl, now);
    if (stale) found.push(stale);

    // 5. Confronto con quanto già noto
    const current = new Map<string, Finding>();
    for (const f of dedupeSiteWide(found)) current.set(fingerprint(f), f);
    const known = new Map((await store.getFindings(clientId)).map((r) => [r.fingerprint, r]));
    const out: FindingRecord[] = [];
    for (const [fp, f] of Array.from(current)) {
        const prev = known.get(fp);
        if (prev) {
            // un problema ignorato o già con task resta com'è; uno risolto che ricompare torna nuovo
            out.push({ ...prev, ...f, fingerprint: fp, lastSeen: startedAt, scanId: id, status: prev.status === 'risolto' ? 'nuovo' : prev.status });
            if (prev.status === 'risolto') base.findingsNew++;
        } else {
            out.push({ ...f, fingerprint: fp, status: 'nuovo', firstSeen: startedAt, lastSeen: startedAt, scanId: id });
            base.findingsNew++;
        }
    }
    // Spariti solo se la scansione è stata completa: se si è fermata a metà, non si può dire che siano risolti.
    if (!stopped && queue.length <= allowed.pages) {
        for (const [fp, prev] of Array.from(known)) {
            if (!current.has(fp) && prev.status !== 'risolto' && prev.status !== 'ignorato') {
                out.push({ ...prev, status: 'risolto', lastSeen: startedAt });
                base.findingsResolved++;
            }
        }
    }
    base.findingsOpen = out.filter((f) => f.status === 'nuovo' || f.status === 'task_creato').length;
    base.creditsUsed = credits;
    base.status = stopped ? 'budget_esaurito' : queue.length > allowed.pages ? 'parziale' : 'ok';
    if (queue.length > allowed.pages) base.note = `lette ${allowed.pages} pagine su ${queue.length} trovate`;

    if (!deps.dryRun) {
        await store.saveFindings(clientId, out);
        await store.saveScan(clientId, base);
        await store.saveState(clientId, { month, creditsUsed: spent + credits, lastScanAt: startedAt });
    }
    return finish(base, out);
}
