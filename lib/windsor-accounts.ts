/**
 * lib/windsor-accounts.ts
 *
 * L'elenco degli account disponibili per un collegamento (Instagram, Facebook pagina, LinkedIn, GBP), con nome e ID, per
 * sceglierli da una lista in Setup API invece di scrivere gli ID a mano.
 *
 * ⚠️ Windsor, interrogato su un collegamento NON configurato, risponde con i dati di un altro collegamento senza errore
 * (misurato il 19/10/2026: «tiktok» restituiva gli account di Google Ads). Perciò prima si controlla l'elenco campi del
 * collegamento: se non è attivo risponde 400 «No X accounts are configured» ed è l'unico segnale affidabile.
 */

import { getData } from './windsor-client';

export type AccountConnector = 'instagram' | 'facebook_organic' | 'linkedin_organic' | 'google_my_business';

export const ACCOUNT_CONNECTORS: AccountConnector[] = ['instagram', 'facebook_organic', 'linkedin_organic', 'google_my_business'];

/** Un campo che il collegamento restituisce davvero: senza almeno una metrica Windsor non risponde con le righe degli account. */
const PROBE_FIELD: Record<AccountConnector, string> = {
    instagram: 'followers_count',
    facebook_organic: 'page_fans',
    linkedin_organic: 'organization_follower_count',
    google_my_business: 'impressions',
};

export interface WindsorAccount { id: string; name: string }

/** Righe con account_id/account_name → un elemento per account, ordinato per nome (senza maiuscole). */
export function uniqueAccounts(rows: { account_id?: unknown; account_name?: unknown }[]): WindsorAccount[] {
    const byId = new Map<string, WindsorAccount>();
    for (const r of rows) {
        const id = r.account_id === undefined || r.account_id === null ? '' : String(r.account_id).trim();
        if (!id || byId.has(id)) continue;
        byId.set(id, { id, name: String(r.account_name ?? '').trim() || id });
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
}

export class ConnectorNotActive extends Error {}

/** Il collegamento è attivo sull'account dati dell'agenzia? (elenco campi: 200 sì, 400 «No X accounts are configured» no) */
async function assertActive(connector: AccountConnector): Promise<void> {
    const key = process.env.WINDSOR_API_KEY;
    if (!key) throw new Error('WINDSOR_API_KEY non configurata');
    const res = await fetch(`https://connectors.windsor.ai/${connector}/fields?api_key=${encodeURIComponent(key)}`, { next: { revalidate: 3600 } });
    if (res.status === 400) throw new ConnectorNotActive('Questo collegamento non è attivo sull\'account dati dell\'agenzia.');
    if (!res.ok) throw new Error(`Il servizio dati ha risposto ${res.status}`);
}

export async function listAccounts(connector: AccountConnector): Promise<WindsorAccount[]> {
    await assertActive(connector);
    const rows = await getData({ connector, fields: ['account_id', 'account_name', PROBE_FIELD[connector]], datePreset: 'last_7d' });
    const accounts = uniqueAccounts(rows);
    // GBP: l'elenco di Windsor mescola alle sedi (id «locations/…») anche account di altri servizi (misurato: 52 sedi su 75
    // voci): una sede vera ha sempre l'id che inizia con «locations/»
    return connector === 'google_my_business' ? accounts.filter(isGbpLocation) : accounts;
}

export const isGbpLocation = (a: WindsorAccount) => a.id.startsWith('locations/');
