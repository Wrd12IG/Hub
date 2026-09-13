/**
 * lib/awin-client.ts
 *
 * Awin (affiliazione) letto direttamente dalla sua API con un token di
 * agenzia: nessun OAuth, nessuna scadenza, nessuno slot Windsor occupato.
 *
 * L'endpoint restituisce le **transazioni** una per una, non dei totali: è il
 * chiamante ad aggregarle. Questo permette di distinguere ciò che è già
 * confermato da ciò che può ancora essere annullato — una distinzione che su
 * un report di affiliazione conta, perché le commissioni in attesa vengono
 * respinte con una certa frequenza e presentarle come fatturato acquisito
 * significa promettere soldi che potrebbero non arrivare.
 */

const BASE = 'https://api.awin.com';

/**
 * Il fuso orario cambia quali transazioni cadono dentro l'intervallo, quindi
 * va dichiarato esplicitamente: la dashboard storica usava Europe/Rome e i
 * numeri devono restare confrontabili con quelli che il cliente ha già visto.
 */
const TIMEZONE = 'Europe/Rome';

/**
 * Stati che non rappresentano denaro: `declined` è stata rifiutata,
 * `deleted` cancellata. Tutto il resto (`pending`, `approved`) è valido, con
 * la differenza che pending può ancora cambiare — per questo viene tenuto
 * separato invece che sommato e basta.
 */
const DEAD_STATUSES = new Set(['declined', 'deleted']);

interface AwinMoney { amount?: number; currency?: string }
interface AwinTransaction {
    commissionStatus?: string;
    saleAmount?: AwinMoney;
    commissionAmount?: AwinMoney;
    networkFee?: AwinMoney;
}

export interface AwinTotals {
    [metric: string]: number;
    /** Transazioni valide (escluse declined e deleted). */
    transactions: number;
    /** Valore degli ordini generati dagli affiliati. */
    sale_amount: number;
    /** Commissioni agli affiliati. */
    commission_amount: number;
    /** Fee di rete Awin. */
    network_fee: number;
    /** Quanto costa davvero il canale: commissioni + fee. */
    total_cost: number;
    /** Scontrino medio. */
    average_order_value: number;
    /** Ritorno: valore ordini / costo del canale. */
    roas: number;
    /** Quota ancora annullabile, da non spacciare per acquisita. */
    pending_transactions: number;
    pending_sale_amount: number;
}

function money(m?: AwinMoney): number {
    return typeof m?.amount === 'number' ? m.amount : 0;
}

function explainError(status: number, body: string): string {
    if (status === 401 || status === 403) {
        return 'Token Awin non valido o senza accesso a questo advertiser. '
            + 'Generane uno da Awin → Toolbox → API credentials.';
    }
    if (status === 404) {
        return 'Advertiser ID Awin inesistente: controlla il valore in Setup API.';
    }
    return `Awin ha risposto ${status}: ${body.slice(0, 200)}`;
}

/**
 * Totali del periodo. Le date sono yyyy-MM-dd, come quelle della UI.
 *
 * ⚠️ Awin accetta al massimo **31 giorni** per richiesta: un intervallo più
 * lungo viene rifiutato, quindi viene spezzato in blocchi e ricomposto.
 */
export async function getAwinTotals(
    apiToken: string,
    advertiserId: string,
    dateFrom: string,
    dateTo: string
): Promise<AwinTotals> {
    const transactions: AwinTransaction[] = [];
    for (const chunk of splitRange(dateFrom, dateTo, 31)) {
        transactions.push(...await fetchTransactions(apiToken, advertiserId, chunk.from, chunk.to));
    }

    const live = transactions.filter((t) => !DEAD_STATUSES.has(String(t.commissionStatus || '').toLowerCase()));
    const pending = live.filter((t) => String(t.commissionStatus || '').toLowerCase() === 'pending');

    const sale = live.reduce((s, t) => s + money(t.saleAmount), 0);
    const commission = live.reduce((s, t) => s + money(t.commissionAmount), 0);
    const fee = live.reduce((s, t) => s + money(t.networkFee), 0);
    const cost = commission + fee;
    const round = (n: number) => Math.round(n * 100) / 100;

    return {
        transactions: live.length,
        sale_amount: round(sale),
        commission_amount: round(commission),
        network_fee: round(fee),
        total_cost: round(cost),
        average_order_value: live.length > 0 ? round(sale / live.length) : 0,
        roas: cost > 0 ? Math.round((sale / cost) * 100) / 100 : 0,
        pending_transactions: pending.length,
        pending_sale_amount: round(pending.reduce((s, t) => s + money(t.saleAmount), 0)),
    };
}

async function fetchTransactions(
    apiToken: string,
    advertiserId: string,
    dateFrom: string,
    dateTo: string
): Promise<AwinTransaction[]> {
    const params = new URLSearchParams({
        startDate: `${dateFrom}T00:00:00`,
        endDate: `${dateTo}T23:59:59`,
        timezone: TIMEZONE,
    });
    const res = await fetch(`${BASE}/advertisers/${encodeURIComponent(advertiserId)}/transactions/?${params}`, {
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
        throw new Error(explainError(res.status, await res.text().catch(() => '')));
    }
    const json = await res.json();
    return Array.isArray(json) ? json : [];
}

/** Intervalli di al massimo `maxDays` giorni, per il limite dell'API. */
function splitRange(from: string, to: string, maxDays: number): { from: string; to: string }[] {
    const out: { from: string; to: string }[] = [];
    const end = new Date(`${to}T00:00:00Z`);
    let cursor = new Date(`${from}T00:00:00Z`);

    while (cursor <= end) {
        const chunkEnd = new Date(cursor);
        chunkEnd.setUTCDate(chunkEnd.getUTCDate() + maxDays - 1);
        out.push({
            from: cursor.toISOString().slice(0, 10),
            to: (chunkEnd < end ? chunkEnd : end).toISOString().slice(0, 10),
        });
        cursor = new Date(chunkEnd);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return out;
}
