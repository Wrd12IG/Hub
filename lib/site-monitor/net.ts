/**
 * lib/site-monitor/net.ts
 *
 * I due controlli diretti, gratuiti (senza Firecrawl): lo stato di un indirizzo e il testo di un file semplice (sitemap).
 * Sola lettura: HEAD (o GET senza leggere il corpo). Si segue un massimo di 5 rimandi e a ogni passo si ricontrolla che l'indirizzo sia pubblico.
 */
import { isPublicHttpUrl } from './firecrawl';
import type { UrlCheck } from './types';

const TIMEOUT_MS = 10_000;
const MAX_HOPS = 5;
const UA = 'WRDigital-SiteMonitor/1.0 (controllo link; sola lettura)';

async function once(url: string, method: 'HEAD' | 'GET') {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
        return await fetch(url, { method, redirect: 'manual', signal: ctrl.signal, headers: { 'User-Agent': UA } });
    } finally { clearTimeout(timer); }
}

export async function checkUrl(start: string): Promise<UrlCheck> {
    let url = start;
    try {
        for (let hops = 0; hops <= MAX_HOPS; hops++) {
            if (!isPublicHttpUrl(url)) return { url: start, status: 0, hops, error: 'indirizzo non consentito' };
            let res = await once(url, 'HEAD');
            if (res.status === 405 || res.status === 501) { await res.body?.cancel().catch(() => undefined); res = await once(url, 'GET'); }
            const loc = res.headers.get('location');
            if (res.status >= 300 && res.status < 400 && loc) {
                await res.body?.cancel().catch(() => undefined);
                url = new URL(loc, url).toString();
                continue;
            }
            const len = Number(res.headers.get('content-length'));
            await res.body?.cancel().catch(() => undefined);
            return { url: start, status: res.status, hops, bytes: Number.isFinite(len) && len > 0 ? len : undefined };
        }
        return { url: start, status: 310, hops: MAX_HOPS + 1 };
    } catch (e) {
        return { url: start, status: 0, error: e instanceof Error ? e.message : 'errore di rete' };
    }
}

/** Testo di un file (max 5 MB). `null` se non c'è o non è raggiungibile. */
export async function fetchText(url: string): Promise<string | null> {
    if (!isPublicHttpUrl(url)) return null;
    try {
        const res = await once(url, 'GET');
        if (!res.ok) { await res.body?.cancel().catch(() => undefined); return null; }
        const text = await res.text();
        return text.length > 5_000_000 ? null : text;
    } catch { return null; }
}
