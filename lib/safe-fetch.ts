import { assertPublicHttpUrl } from '@/lib/site-intelligence';

const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 2_000_000;

/** Scarica la pagina seguendo i redirect a mano: ogni passaggio deve restare su un host pubblico. */
export async function fetchPage(rawUrl: string, timeoutMs = 12_000): Promise<{ url: string; html: string; status: number }> {
    let url = assertPublicHttpUrl(rawUrl);
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
        const res = await fetch(url.href, {
            redirect: 'manual',
            signal: AbortSignal.timeout(timeoutMs),
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WRDigitalHub/1.0)', Accept: 'text/html' },
        });
        if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
            url = assertPublicHttpUrl(new URL(res.headers.get('location')!, url).href);
            continue;
        }
        if (!res.ok) throw new Error(`Il sito ha risposto ${res.status}`);
        const html = (await res.text()).slice(0, MAX_HTML_BYTES);
        return { url: url.href, html, status: res.status };
    }
    throw new Error('Troppi reindirizzamenti leggendo il sito');
}

