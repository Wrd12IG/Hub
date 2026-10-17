import { Composio } from '@composio/core';

// Composio come fonte dati del Hub (pilota: Google Ads).
//
// Identità: UNA sola, quella dell'agenzia. L'account Google che amministra l'MCC si collega una volta
// (Connect Link) e i clienti si leggono passando il loro customer_id: non serve un OAuth per cliente.
// Credenziale: COMPOSIO_API_KEY (progetto Hub_wrdigital, Dashboard > Platform > Getting Started).
// Mai nel codice né nei log.

const AGENCY_USER_ID = process.env.COMPOSIO_AGENCY_USER_ID || 'wrdigital-agency';

let composioInstance: Composio | null = null;
const sessions = new Map<string, any>();

export function isComposioConfigured(): boolean {
    const key = process.env.COMPOSIO_API_KEY;
    return !!key && key.length > 8 && /^[A-Za-z0-9_-]+$/.test(key) && !/xxx|your_|placeholder/i.test(key);
}

function getComposio(): Composio {
    if (!isComposioConfigured()) throw new Error('Composio non configurato: manca COMPOSIO_API_KEY');
    // L'SDK legge COMPOSIO_API_KEY dall'ambiente
    return (composioInstance ||= new Composio());
}

async function getSession(toolkit: string) {
    let session = sessions.get(toolkit);
    if (!session) {
        // Sessione limitata al solo toolkit che serve: nessun altro strumento esposto
        session = await getComposio().create(AGENCY_USER_ID, { toolkits: [toolkit] });
        sessions.set(toolkit, session);
    }
    return session;
}

export class ComposioNotConnectedError extends Error {
    constructor(public toolkit: string, public connectUrl?: string) {
        super(`Composio: toolkit "${toolkit}" non collegato per l'agenzia${connectUrl ? `. Autorizza qui: ${connectUrl}` : ''}`);
    }
}

export interface ComposioResult<T = unknown> {
    data: T;
    logId?: string;
}

/** Esegue un tool e restituisce i dati. Errore esplicito, con log ID, se fallisce o se manca il collegamento. */
/** Il collegamento manca: l'SDK lo segnala come eccezione (400, codice 4302), non come risultato. */
function isNotConnected(message: string): boolean {
    return /no active connection|4302|not\s+linked|connect(ed)?\s+account/i.test(message);
}

async function connectUrlFor(session: any, toolkit: string): Promise<string | undefined> {
    try { return (await session.authorize(toolkit))?.redirectUrl; } catch { return undefined; }
}

/** Esegue un tool e restituisce i dati. Errore esplicito, con log ID, se fallisce o se manca il collegamento. */
export async function composioExecute<T = unknown>(
    toolkit: string,
    toolSlug: string,
    args: Record<string, unknown>,
): Promise<ComposioResult<T>> {
    const session = await getSession(toolkit);

    let res: any;
    try {
        res = await session.execute(toolSlug, args);
    } catch (err: any) {
        const message = String(err?.message || err);
        if (isNotConnected(message)) throw new ComposioNotConnectedError(toolkit, await connectUrlFor(session, toolkit));
        throw err;
    }

    const failed = res?.resultType === 'failed' || !!res?.error;
    if (failed) {
        const message = String(res?.error || 'errore sconosciuto');
        if (isNotConnected(message)) throw new ComposioNotConnectedError(toolkit, await connectUrlFor(session, toolkit));
        throw new Error(`Composio ${toolSlug}: ${message}${res?.logId ? ` (log ${res.logId})` : ''}`);
    }
    return { data: res.data as T, logId: res.logId };
}
