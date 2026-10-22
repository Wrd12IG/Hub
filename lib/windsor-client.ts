/**
 * lib/windsor-client.ts
 *
 * Thin client for the Windsor.ai Connectors API (https://windsor.ai/api-documentation/).
 * This same Windsor.ai account already powers dashboard.wrdigital.it — this module
 * lets the Hub pull the same data for its own client-facing reporting (Fase 1 della
 * roadmap marketing platform), and later drive Windsor's write actions (Instagram/
 * LinkedIn/GBP posting) for the publishing phase.
 *
 * Requires WINDSOR_API_KEY in the environment (server-side only — never exposed to
 * the client bundle). Get it from https://onboard.windsor.ai (Account → API Key).
 */

const BASE_URL = 'https://connectors.windsor.ai';

export type WindsorConnector =
    | 'facebook'          // Meta Ads
    | 'facebook_organic'  // Meta organic page posts (not yet connected on the account)
    | 'instagram'         // Instagram (organic + business insights)
    | 'google_ads'
    | 'googleanalytics4'
    | 'searchconsole'
    | 'linkedin_organic'
    | 'google_my_business' // not yet connected on the account
    | 'tiktok';            // Ads only — no organic publishing support on Windsor

export interface WindsorRow {
    account_id?: string;
    account_name?: string;
    [field: string]: string | number | undefined;
}

function getApiKey(): string {
    const key = process.env.WINDSOR_API_KEY;
    if (!key) {
        throw new Error('[windsor-client] WINDSOR_API_KEY is not configured in the environment.');
    }
    return key;
}

/** Oggi come yyyy-MM-dd (UTC, come le date che il Hub manda a Windsor). */
function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}

/** Il giorno prima di una data yyyy-MM-dd, o null se la stringa non è una data. */
export function previousDay(iso: string): string | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return null;
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}

/**
 * Read data from a Windsor connector.
 *
 * `accountId`, when passed, is applied both as a server-side filter (so we never
 * pull more accounts than we need) and belt-and-braces client-side (Windsor's
 * account-scoping support varies slightly per connector).
 */
export async function getData({
    connector,
    accountId,
    accountIds,
    fields,
    datePreset = 'last_30d',
    dateFrom,
    dateTo,
    fresh = false,
}: {
    connector: WindsorConnector;
    accountId?: string;
    /**
     * Più account in UNA chiamata, con il filtro `account_id in [...]` applicato da Windsor.
     * `account_id` come parametro semplice viene ignorato dal server: ogni chiamata restituisce
     * tutti gli account del connector (GBP: 75 sedi, 19,5 s misurati). Con questo filtro
     * le stesse sedi tornano in ~3 s. Misurato il 17/10/2026 su 4 sedi di City Motors.
     */
    accountIds?: string[];
    fields: string[];
    datePreset?: string;
    dateFrom?: string;
    dateTo?: string;
    /** Salta la cache condivisa e rilegge Windsor (pulsante Aggiorna). */
    fresh?: boolean;
}): Promise<WindsorRow[]> {
    const params = new URLSearchParams({
        api_key: getApiKey(),
        connector,
        fields: fields.join(','),
    });

    if (dateFrom) {
        params.set('date_from', dateFrom);
        if (dateTo) params.set('date_to', dateTo);
    } else {
        params.set('date_preset', datePreset);
    }

    if (accountId) {
        params.set('account_id', accountId);
    }
    // Un singolo `accountId` passa dallo stesso filtro lato Windsor delle liste: il parametro semplice `account_id`
    // viene ignorato dal server, che restituisce TUTTI gli account del connector e il Hub ne teneva uno.
    // Misurato il 18/10/2026 su City Motors: Meta 27,2 s → 0,9 s, Instagram 6,5 s → 1,6 s (e GBP 19,5 s → 3 s).
    const serverSideIds = accountIds && accountIds.length > 0 ? accountIds : accountId ? [accountId] : [];
    if (serverSideIds.length > 0) {
        params.set('filter', JSON.stringify([['account_id', 'in', JSON.stringify(serverSideIds)]]));
    }

    const url = `${BASE_URL}/all?${params.toString()}`;

    let response: Response;
    try {
        // Windsor impiega 8-12 s per lettura (misurato il 19/10/2026): la cache condivisa di Next (5 minuti, valida
        // fra tutte le istanze Vercel) fa sì che la seconda apertura di una pagina sia istantanea.
        response = await fetch(url, fresh ? { cache: 'no-store' } : { next: { revalidate: 300 } });
    } catch (err) {
        console.error(`[windsor-client] Network error calling ${connector}:`, err);
        throw new Error(`Impossibile contattare il servizio dati per ${connector}`);
    }

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(`[windsor-client] ${connector} → HTTP ${response.status}:`, errorBody);
        throw new Error(`Il servizio dati ha risposto ${response.status} per ${connector}`);
    }

    const json = await response.json();
    const rows: WindsorRow[] = json.data || [];

    // Una finestra che finisce OGGI può tornare vuota per un account collegato da poco (il dato di oggi non c'è ancora),
    // mentre la stessa fino a ieri dà i numeri veri: misurato il 22/10/2026 sulla pagina Facebook di WR Digital.
    // Si riprova una volta con la fine spostata a ieri; la lettura "fresh" resta fresh.
    if (rows.length === 0 && dateFrom && dateTo) {
        const yesterday = previousDay(dateTo);
        if (yesterday && dateTo >= todayIso() && yesterday >= dateFrom) {
            return getData({ connector, accountId, accountIds, fields, dateFrom, dateTo: yesterday, fresh });
        }
    }

    // Belt-and-braces client-side filter: some connectors (e.g. facebook) accept
    // account_id server-side, others silently ignore an unrecognized filter param
    // and return every connected account instead of erroring — never trust that
    // an unfiltered response means "no account_id was requested".
    if (accountId) {
        return rows.filter((row) => String(row.account_id) === String(accountId));
    }
    if (accountIds && accountIds.length > 0) {
        const wanted = new Set(accountIds.map(String));
        return rows.filter((row) => wanted.has(String(row.account_id)));
    }
    return rows;
}

/**
 * List a connector's available write actions and their parameter schemas.
 * Mirrors GET /{connector}/actions from the Windsor API docs.
 */
export async function listActions(connector: WindsorConnector): Promise<unknown> {
    const params = new URLSearchParams({ api_key: getApiKey() });
    const response = await fetch(`${BASE_URL}/${connector}/actions?${params.toString()}`);
    if (!response.ok) {
        throw new Error(`Il servizio dati ha risposto ${response.status} nel listare le azioni di ${connector}`);
    }
    return response.json();
}

/**
 * Execute a write action on a connector (e.g. create_image_post on instagram,
 * create_local_post on google_my_business). Kept generic and untyped-in-detail
 * here — the publishing phase (Fase 3) will add a typed wrapper per action once
 * we design the approval-queue that calls it, matching each action's own schema
 * (fetch it first via listActions rather than assuming the shape).
 */
export async function executeAction(
    connector: WindsorConnector,
    action: string,
    accountId: string,
    params: Record<string, unknown>
): Promise<unknown> {
    // Forma documentata (windsor.ai/api-documentation, "Execute an action"): POST /{connector}/actions con
    // { account, action, params } e la chiave nella query. L'account è SEMPRE esplicito: Windsor non deve mai
    // scegliere da solo a quale profilo pubblicare.
    if (!accountId || !accountId.trim()) throw new Error(`Azione ${action} su ${connector}: account mancante`);
    const response = await fetch(`${BASE_URL}/${connector}/actions?${new URLSearchParams({ api_key: getApiKey() }).toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: accountId, action, params }),
        cache: 'no-store',
    });
    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(`[windsor-client] action ${connector}/${action} failed:`, errorBody);
        throw new Error(`Azione ${action} su ${connector} fallita (HTTP ${response.status})${errorBody ? `: ${errorBody.slice(0, 700)}` : ''}`);
    }
    return response.json();
}

// Kept for any existing (currently non-existent, per grep) caller using the old
// class-based API — new code should prefer the plain getData() export above.
export class WindsorClient {
    static getData = getData;
}
