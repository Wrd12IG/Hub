/**
 * lib/competitors-client.ts
 *
 * Monitoraggio dei competitor territoriali: legge le pagine pubbliche dei
 * concorrenti indicati dallo staff e ne conserva un'istantanea, per poter dire
 * **cosa è cambiato** e quando.
 *
 * Il valore non sta nel riassunto ma nel confronto nel tempo: "il 12/09 ha
 * lanciato una promo", "questo sito ha chiuso". Sono fatti con una data e una
 * fonte, verificabili aprendo il link — non l'opinione di un modello.
 *
 * ⚠️ **I social non si leggono.** Misurato: una richiesta a un profilo
 * Instagram torna 81 caratteri di pagina vuota, una a una pagina aziendale
 * LinkedIn torna 404. Restano salvati come collegamenti rapidi, dichiarati
 * per quello che sono. Promettere numeri social da qui sarebbe inventarli.
 */

export interface CompetitorSnapshot {
    url: string;
    fetchedAt: number;
    /** 'direct' = fetch normale, 'firecrawl' = ripiego per i siti che bloccano. */
    via: 'direct' | 'firecrawl';
    title: string;
    description: string;
    /** Frasi promozionali trovate in pagina, così come sono scritte. */
    offers: string[];
    /** Impronta del testo: se cambia, la pagina è cambiata. */
    fingerprint: string;
    textLength: number;
}

export interface CompetitorFetchResult {
    ok: boolean;
    snapshot?: CompetitorSnapshot;
    /** Perché non è stato possibile leggere, in parole utili. */
    error?: string;
}

const UA = 'Mozilla/5.0 (compatible; WRDigitalHub/1.0; +https://hub.wrdigital.it)';
const TIMEOUT_MS = 20_000;

/** Testo leggibile da una pagina HTML, senza script, stili e tag. */
function toText(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function metaContent(html: string, name: string): string {
    const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']{0,300})`, 'i');
    const alt = new RegExp(`<meta[^>]+content=["']([^"']{0,300})["'][^>]*(?:name|property)=["']${name}["']`, 'i');
    return (re.exec(html)?.[1] ?? alt.exec(html)?.[1] ?? '').trim();
}

/**
 * Frasi che annunciano un'offerta.
 *
 * Deliberatamente conservativo: si prendono solo frasi che contengono una
 * parola d'offerta **e** una cifra o una percentuale. Un elenco più generoso
 * riempirebbe la sezione di rumore, e una lista di avvisi che nessuno legge
 * è peggio di nessuna lista.
 */
const OFFER_WORDS = /(sconto|sconti|promo|promozione|offerta|offerte|saldi|black friday|outlet|risparmi|omaggio|gratis|spedizione gratuita)/i;

function extractOffers(text: string): string[] {
    const sentences = text.split(/(?<=[.!?•|])\s+|\s{2,}/);
    const found = sentences
        .map((s) => s.trim())
        .filter((s) => s.length > 8 && s.length < 160)
        .filter((s) => OFFER_WORDS.test(s) && /\d/.test(s));
    return Array.from(new Set(found)).slice(0, 8);
}

/** Impronta stabile del contenuto testuale, per accorgersi dei cambiamenti. */
async function fingerprint(text: string): Promise<string> {
    const { createHash } = await import('node:crypto');
    return createHash('sha256').update(text.slice(0, 20_000)).digest('hex').slice(0, 16);
}

function buildSnapshot(url: string, html: string, via: 'direct' | 'firecrawl'): Promise<CompetitorSnapshot> {
    const text = toText(html);
    return fingerprint(text).then((fp) => ({
        url,
        fetchedAt: Date.now(),
        via,
        title: (/<title[^>]*>([^<]{0,200})/i.exec(html)?.[1] ?? '').trim(),
        description: metaContent(html, 'description') || metaContent(html, 'og:description'),
        offers: extractOffers(text),
        fingerprint: fp,
        textLength: text.length,
    }));
}

/**
 * Ripiego per i siti che bloccano una richiesta diretta (tipicamente dietro
 * Cloudflare). Costa crediti, quindi si tenta **solo** dopo il fallimento.
 * Senza chiave configurata non è un errore: è semplicemente una strada che
 * non abbiamo, e va detto invece di far sembrare il sito irraggiungibile.
 */
async function viaFirecrawl(url: string): Promise<CompetitorFetchResult> {
    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) {
        return { ok: false, error: 'Il sito blocca la lettura diretta. Serve FIRECRAWL_API_KEY per riprovare da un altro percorso.' };
    }
    try {
        const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
            body: JSON.stringify({ url, formats: ['rawHtml'], onlyMainContent: false }),
            signal: AbortSignal.timeout(45_000),
        });
        const json = await res.json().catch(() => ({} as any));
        if (!res.ok) {
            const detail = String(json?.error ?? `HTTP ${res.status}`);
            return {
                ok: false,
                error: /credit/i.test(detail)
                    ? 'Il sito blocca la lettura diretta e i crediti Firecrawl sono esauriti.'
                    : `Il sito blocca la lettura diretta e anche Firecrawl ha fallito: ${detail.slice(0, 120)}`,
            };
        }
        const html = json?.data?.rawHtml ?? json?.data?.html ?? '';
        if (!html) return { ok: false, error: 'Firecrawl non ha restituito contenuto per questa pagina.' };
        return { ok: true, snapshot: await buildSnapshot(url, html, 'firecrawl') };
    } catch (err: any) {
        return { ok: false, error: `Firecrawl non raggiungibile: ${String(err.message).slice(0, 100)}` };
    }
}

/**
 * Legge la pagina di un competitor. Prima con una richiesta normale — gratis,
 * e sui siti provati funziona — e solo se quella fallisce con Firecrawl.
 */
export async function fetchCompetitorPage(url: string): Promise<CompetitorFetchResult> {
    try {
        const res = await fetch(url, {
            headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
            signal: AbortSignal.timeout(TIMEOUT_MS),
            redirect: 'follow',
        });
        if (!res.ok) return viaFirecrawl(url);

        const html = await res.text();
        const snapshot = await buildSnapshot(url, html, 'direct');

        // Una pagina servita ma praticamente vuota è il sintomo del contenuto
        // caricato via JavaScript: i profili Instagram tornano così, ~80
        // caratteri. Vale come blocco, non come pagina letta.
        if (snapshot.textLength < 500) return viaFirecrawl(url);

        return { ok: true, snapshot };
    } catch {
        return viaFirecrawl(url);
    }
}

/** Cosa è cambiato fra due letture della stessa pagina. */
export function diffSnapshots(prev: CompetitorSnapshot | null, next: CompetitorSnapshot): string[] {
    if (!prev) return [];
    const changes: string[] = [];

    if (prev.title && next.title && prev.title !== next.title) {
        changes.push(`Titolo del sito cambiato: "${prev.title.slice(0, 60)}" → "${next.title.slice(0, 60)}"`);
    }

    const before = new Set(prev.offers);
    const nuove = next.offers.filter((o) => !before.has(o));
    for (const o of nuove.slice(0, 3)) changes.push(`Nuova offerta in homepage: "${o.slice(0, 100)}"`);

    const after = new Set(next.offers);
    const finite = prev.offers.filter((o) => !after.has(o));
    if (finite.length > 0 && nuove.length === 0) {
        changes.push(`${finite.length} offerta/e non più in homepage`);
    }

    // Un crollo del testo di solito è un sito rifatto o andato giù, non una
    // modifica di contenuto: merita una segnalazione diversa.
    if (prev.textLength > 2000 && next.textLength < prev.textLength * 0.3) {
        changes.push('La homepage è quasi vuota rispetto alla lettura precedente: sito in manutenzione o rifatto');
    } else if (changes.length === 0 && prev.fingerprint !== next.fingerprint) {
        changes.push('Contenuti della homepage aggiornati');
    }

    return changes;
}
