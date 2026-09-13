/**
 * lib/search-console-client.ts
 *
 * Search Console letta direttamente dall'API ufficiale di Google con il
 * **service account dell'agenzia**, esattamente come GA4 (vedi lib/ga4-client.ts):
 * per collegare un nuovo sito basta aggiungere l'email del service account fra
 * gli utenti della proprietà in Search Console. Nessun OAuth per cliente,
 * nessun refresh token, nessun costo, nessuno slot Windsor occupato.
 *
 * Rispetto ai dati che arrivavano da Windsor questa via aggiunge le dimensioni
 * vere della Search Console — query, pagine, dispositivi, paesi — che il
 * connector non esponeva affatto. Sui totali i due percorsi coincidono: 284
 * click / 26.923 impression / posizione 7,96 su entrambi, verificati fianco a
 * fianco su un sito reale.
 */

import { JWT } from 'google-auth-library';

const API = 'https://searchconsole.googleapis.com/webmasters/v3';

function getClient(): JWT {
    const email = process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_EMAIL;
    // Stesso service account di GA4: le \n della chiave possono arrivare
    // escapate dall'env, come lì.
    const key = process.env.GOOGLE_ANALYTICS_PRIVATE_KEY?.replace(/\\n/g, '\n');
    if (!email || !key) throw new Error('Mancano credenziali Service Account Google (GOOGLE_ANALYTICS_*)');

    return new JWT({
        email,
        key,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    });
}

/**
 * Come per GA4, l'errore che capita davvero è uno solo: il service account non
 * è stato aggiunto fra gli utenti della proprietà. Google lo dice in inglese e
 * senza indicare cosa fare, quindi lo riscriviamo come istruzione.
 *
 * ⚠️ In Search Console, a differenza di GA4, NON esiste un permesso a livello
 * di account: va aggiunto proprietà per proprietà.
 */
function explainError(err: any, siteUrl: string): string {
    const email = process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_EMAIL || 'il service account del Hub';
    const status = err?.response?.status ?? err?.code;
    const msg = String(err?.response?.data?.error?.message || err?.message || err);

    if (status === 403 || /sufficient permission/i.test(msg)) {
        return `Il service account non è autorizzato sulla proprietà Search Console ${siteUrl}. `
            + `Aprila in Search Console → Impostazioni → Utenti e autorizzazioni → Aggiungi utente, `
            + `inserisci ${email} con permesso "Con limitazioni".`;
    }
    if (status === 404) {
        return `Proprietà Search Console ${siteUrl} inesistente. L'URL deve combaciare esattamente con `
            + `quello registrato in Search Console, barra finale compresa (es. https://www.esempio.it/).`;
    }
    return msg;
}

async function query(
    siteUrl: string,
    body: Record<string, unknown>
): Promise<any[]> {
    const client = getClient();
    try {
        const res: any = await client.request({
            url: `${API}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
            method: 'POST',
            data: body,
        });
        return res.data.rows || [];
    } catch (err: any) {
        throw new Error(explainError(err, siteUrl));
    }
}

/**
 * Totali del periodo. Le chiavi restituite sono volutamente le stesse che la UI
 * già legge da Windsor (`clicks`, `impressions`, `ctr`, `position`), così le
 * schede esistenti continuano a funzionare senza modifiche.
 *
 * ⚠️ `ctr` esce come **frazione** (0,0105 = 1,05%), non in percentuale: è la
 * convenzione di Google ed era anche quella che restituiva Windsor, quindi
 * lib/seo-audit.ts la usa già così (`gsc.ctr / 0.05`). Convertirla qui
 * romperebbe in silenzio il punteggio SEO.
 */
export interface SearchConsoleTotals {
    /** PlatformReport.rows è una mappa generica: l'index signature la soddisfa. */
    [metric: string]: number;
    clicks: number;
    impressions: number;
    /** Frazione, non percentuale — vedi la nota qui sopra. */
    ctr: number;
    position: number;
}

export async function getSearchConsoleTotals(
    siteUrl: string,
    startDate: string,
    endDate: string
): Promise<SearchConsoleTotals> {
    const rows = await query(siteUrl, { startDate, endDate, dimensions: [] });
    const r = rows[0];
    return {
        clicks: r?.clicks ?? 0,
        impressions: r?.impressions ?? 0,
        ctr: r?.ctr ?? 0,
        position: r?.position ?? 0,
    };
}

export interface SearchConsoleRow {
    key: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}

/**
 * Dettaglio per dimensione: le query che portano traffico, le pagine che lo
 * ricevono, la ripartizione per dispositivo o paese. È la parte che il
 * connector Windsor non esponeva per niente.
 */
export async function getSearchConsoleBreakdown(
    siteUrl: string,
    startDate: string,
    endDate: string,
    dimension: 'query' | 'page' | 'device' | 'country',
    limit = 25
): Promise<SearchConsoleRow[]> {
    const rows = await query(siteUrl, { startDate, endDate, dimensions: [dimension], rowLimit: limit });
    return rows.map((r: any) => ({
        key: String(r.keys?.[0] ?? ''),
        clicks: r.clicks ?? 0,
        impressions: r.impressions ?? 0,
        ctr: r.ctr ?? 0,
        position: r.position ?? 0,
    }));
}
