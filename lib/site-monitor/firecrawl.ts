/**
 * lib/site-monitor/firecrawl.ts
 *
 * Client minimo per Firecrawl (REST v2). La chiave arriva da fuori (variabile d'ambiente), mai scritta nel codice né nei log.
 * `fetchImpl` si può sostituire: nei test si usa un Firecrawl finto, che non spende crediti.
 */
import type { PageData } from './types';

export type FetchLike = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{
    ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string>;
}>;

export interface FirecrawlClient {
    /** Legge una pagina (1 credito). Non lancia: gli errori diventano `status: 0` con `error`. */
    scrape(url: string): Promise<PageData & { credits: number }>;
    /** Crediti rimasti nel piano (gratis). `null` se non leggibili. */
    creditsRemaining(): Promise<number | null>;
}

export interface FirecrawlOptions {
    apiKey: string;
    fetchImpl?: FetchLike;
    baseUrl?: string;
    timeoutMs?: number;
}

/** Solo http/https verso host pubblici: niente indirizzi interni (la scansione è in sola lettura e non deve toccare la rete nostra). */
export function isPublicHttpUrl(raw: string): boolean {
    let u: URL;
    try { u = new URL(raw); } catch { return false; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const h = u.hostname.toLowerCase();
    if (!h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
        const [a, b] = h.split('.').map(Number);
        if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
    }
    return !h.startsWith('[');
}

export function createFirecrawlClient(opts: FirecrawlOptions): FirecrawlClient {
    const base = opts.baseUrl ?? 'https://api.firecrawl.dev';
    const doFetch: FetchLike = opts.fetchImpl ?? ((i, init) => fetch(i, init) as ReturnType<FetchLike>);
    const headers = { Authorization: `Bearer ${opts.apiKey}`, 'Content-Type': 'application/json' };

    return {
        async scrape(url) {
            if (!isPublicHttpUrl(url)) return { url, status: 0, html: '', error: 'indirizzo non consentito', credits: 0 };
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 45_000);
            try {
                const res = await doFetch(`${base}/v2/scrape`, {
                    method: 'POST', headers, signal: ctrl.signal,
                    body: JSON.stringify({ url, formats: ['rawHtml'], onlyMainContent: false }),
                });
                const body = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string; data?: { rawHtml?: string; metadata?: { statusCode?: number; error?: string } } };
                if (!res.ok || body.success === false) {
                    // 402/429 = crediti o limite: va fermato tutto, non è un problema del sito
                    return { url, status: 0, html: '', error: res.status === 402 || res.status === 429 ? `firecrawl_${res.status}` : (body.error ?? `firecrawl_${res.status}`), credits: 0 };
                }
                const meta = body.data?.metadata;
                return { url, status: meta?.statusCode ?? 200, html: body.data?.rawHtml ?? '', error: meta?.error, credits: 1 };
            } catch (e) {
                return { url, status: 0, html: '', error: e instanceof Error ? e.message : 'errore di rete', credits: 0 };
            } finally { clearTimeout(timer); }
        },
        async creditsRemaining() {
            try {
                const res = await doFetch(`${base}/v2/team/credit-usage`, { headers });
                if (!res.ok) return null;
                const b = (await res.json()) as { data?: { remainingCredits?: number } };
                return typeof b.data?.remainingCredits === 'number' ? b.data.remainingCredits : null;
            } catch { return null; }
        },
    };
}
