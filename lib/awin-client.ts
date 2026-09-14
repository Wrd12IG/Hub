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
    id?: number | string;
    commissionStatus?: string;
    saleAmount?: AwinMoney;
    commissionAmount?: AwinMoney;
    networkFee?: AwinMoney;
    siteName?: string;
    publisherId?: number | string;
    transactionDate?: string;
    transactionDevice?: string;
    voucherCodeUsed?: boolean;
    voucherCode?: string;
    customerAcquisition?: string;
    declineReason?: string;
}

export interface AwinPublisherRow {
    publisher: string;
    publisherId: string;
    transactions: number;
    sale_amount: number;
    commission_amount: number;
    network_fee: number;
    total_cost: number;
    roas: number;
    average_order_value: number;
    pending_transactions: number;
}

export interface AwinTransactionRow {
    id: string;
    date: string;
    publisher: string;
    status: string;
    sale_amount: number;
    commission_amount: number;
    device: string;
    voucher: string;
    new_customer: boolean;
    decline_reason: string;
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
    const transactions = await fetchAllTransactions(apiToken, advertiserId, dateFrom, dateTo);

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


/**
 * Le transazioni del periodo, grezze e già normalizzate per la tabella.
 *
 * Le `declined` restano nell'elenco — con il loro motivo di rifiuto — invece
 * di sparire: quando una commissione viene respinta, sapere *perché* è
 * esattamente l'informazione che serve. Sono però escluse da qualsiasi totale.
 */
export async function getAwinTransactionRows(
    apiToken: string,
    advertiserId: string,
    dateFrom: string,
    dateTo: string
): Promise<AwinTransactionRow[]> {
    const all = await fetchAllTransactions(apiToken, advertiserId, dateFrom, dateTo);
    return all
        .map((t) => ({
            id: String(t.id ?? ''),
            date: String(t.transactionDate ?? '').slice(0, 16).replace('T', ' '),
            publisher: String(t.siteName ?? t.publisherId ?? '—'),
            status: String(t.commissionStatus ?? ''),
            sale_amount: money(t.saleAmount),
            commission_amount: money(t.commissionAmount),
            device: String(t.transactionDevice ?? ''),
            voucher: t.voucherCodeUsed ? String(t.voucherCode ?? 'sì') : '',
            new_customer: String(t.customerAcquisition ?? '').toUpperCase() === 'NEW',
            decline_reason: String(t.declineReason ?? ''),
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Ripartizione per publisher: quali affiliati portano fatturato e a che costo.
 *
 * È la domanda vera dell'affiliazione — un publisher può generare molti ordini
 * e costare poco, o pochissimi e prendersi una commissione alta. Il totale
 * aggregato non lo mostra, la ripartizione sì.
 */
export async function getAwinByPublisher(
    apiToken: string,
    advertiserId: string,
    dateFrom: string,
    dateTo: string
): Promise<AwinPublisherRow[]> {
    const all = await fetchAllTransactions(apiToken, advertiserId, dateFrom, dateTo);
    const live = all.filter((t) => !DEAD_STATUSES.has(String(t.commissionStatus || '').toLowerCase()));

    const byPublisher = new Map<string, AwinPublisherRow>();
    for (const t of live) {
        const key = String(t.siteName ?? t.publisherId ?? '—');
        const e = byPublisher.get(key) || {
            publisher: key, publisherId: String(t.publisherId ?? ''),
            transactions: 0, sale_amount: 0, commission_amount: 0, network_fee: 0,
            total_cost: 0, roas: 0, average_order_value: 0, pending_transactions: 0,
        };
        e.transactions += 1;
        e.sale_amount += money(t.saleAmount);
        e.commission_amount += money(t.commissionAmount);
        e.network_fee += money(t.networkFee);
        if (String(t.commissionStatus || '').toLowerCase() === 'pending') e.pending_transactions += 1;
        byPublisher.set(key, e);
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    return Array.from(byPublisher.values())
        .map((p) => {
            const cost = p.commission_amount + p.network_fee;
            return {
                ...p,
                sale_amount: round(p.sale_amount),
                commission_amount: round(p.commission_amount),
                network_fee: round(p.network_fee),
                total_cost: round(cost),
                roas: cost > 0 ? round(p.sale_amount / cost) : 0,
                average_order_value: p.transactions > 0 ? round(p.sale_amount / p.transactions) : 0,
            };
        })
        .sort((a, b) => b.sale_amount - a.sale_amount);
}

/** Scarica tutte le transazioni del periodo, rispettando il limite di 31 giorni. */
async function fetchAllTransactions(
    apiToken: string,
    advertiserId: string,
    dateFrom: string,
    dateTo: string
): Promise<AwinTransaction[]> {
    const out: AwinTransaction[] = [];
    for (const chunk of splitRange(dateFrom, dateTo, 31)) {
        out.push(...await fetchTransactions(apiToken, advertiserId, chunk.from, chunk.to));
    }
    return out;
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
