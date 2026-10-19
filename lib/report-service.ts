/**
 * lib/report-service.ts
 *
 * Il calcolo del report di un cliente con la sua cache, in un posto solo: lo usano la route che risponde alla pagina
 * e il giro notturno (app/api/cron/warm-reports) che lo prepara prima che qualcuno apra il cliente.
 */

import { adminDb } from './firebase-admin';
import { getClientToken } from './api-auth';
import { getClientMarketingReport, buildWindows, type CompareMode, type PlatformReport } from './reporting';
import type { Client } from './data';
import type { ReportProgress } from './report-warm';
import { buildRangeWindows, type DateRange } from './date-range';

/**
 * Quanto resta valido un report in cache.
 *
 * Misurato su Windsor: linkedin_organic 15,0s, google_my_business 11,4s per sede (e le sedi vanno in sequenza,
 * perché Windsor le rifiuta in parallelo), facebook 10,6s. Il report gira le piattaforme in parallelo, quindi il
 * totale è dettato dalla più lenta.
 *
 * ⚠️ Un report con una piattaforma in errore NON va tenuto sei ore: l'utente si vedrebbe lo stesso errore transitorio
 * per tutta la giornata, senza capire perché "Aggiorna" non cambia nulla. In quel caso la cache dura due minuti.
 * Stessa regola per il report vuoto (nessuna integrazione).
 */
export const TTL_OK_MS = 6 * 60 * 60 * 1000;
export const TTL_DEGRADED_MS = 2 * 60 * 1000;

/**
 * Una voce di cache per combinazione di periodo e confronto: un report a 7 giorni e uno a 90 non sono lo stesso dato.
 * `report5`: le voci vecchie non hanno gli andamenti per piattaforma (`report4`: la serie giornaliera di Meta e Google Ads; `report3`: i contatti di GBP, `report2`: lead e costi di Meta).
 */
export function reportCacheKey(datePreset: string, days: string, compare: CompareMode): string {
    return `report5_${datePreset}_${days}_${compare}`.replace(/[^A-Za-z0-9_-]/g, '');
}

/** La vista predefinita della Panoramica (30 giorni, confronto col periodo precedente): è quella che il giro notturno prepara. */
export const DEFAULT_VIEW = { datePreset: 'last_30d', days: '30', compare: 'prev_period' as CompareMode };

/**
 * ⚠️ Firestore rifiuta i valori `undefined` e questo progetto non ha `ignoreUndefinedProperties`: il giro da JSON li
 * toglie, e ciò che finisce in cache è esattamente ciò che il client riceverebbe via HTTP.
 */
export function forFirestore<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

export function ttlFor(platforms: PlatformReport[]): number {
    if (platforms.length === 0) return TTL_DEGRADED_MS;
    return platforms.some((p) => !p.connected) ? TTL_DEGRADED_MS : TTL_OK_MS;
}

export interface ReportResult {
    clientId: string;
    datePreset: string;
    compare: CompareMode;
    windows: unknown;
    platforms: PlatformReport[];
    computedAt: string;
    cached: boolean;
}

const cacheRef = (clientId: string, key: string) => adminDb.collection('clients').doc(clientId).collection('cache').doc(key);
const progressRef = (clientId: string) => cacheRef(clientId, 'report_progress');

/** Scrive l'avanzamento di un calcolo in corso: la pagina lo legge ogni poco e mostra la barra. Mai bloccante. */
function makeProgressWriter(clientId: string, runId: string) {
    const steps: ReportProgress['steps'] = [];
    return (e: { done: number; total: number; label: string; ok: boolean }, finished = false) => {
        if (e.label) steps.push({ label: e.label, ok: e.ok });
        const doc: ReportProgress = { runId, total: e.total, done: e.done, steps: [...steps], finished, updatedAt: Date.now() };
        return progressRef(clientId).set(doc).catch(() => undefined);
    };
}

export async function readProgress(clientId: string, runId: string): Promise<ReportProgress | null> {
    const snap = await progressRef(clientId).get().catch(() => null);
    const data = snap?.exists ? (snap.data() as ReportProgress) : null;
    return data && data.runId === runId ? data : null;
}

/**
 * Il report di un cliente: dalla cache se valida (salvo `refresh`), altrimenti calcolato e salvato.
 * Restituisce null se il cliente non esiste.
 */
export async function getReport(opts: {
    clientId: string;
    datePreset: string;
    daysRaw: string;
    compare: CompareMode;
    refresh?: boolean;
    runId?: string;
    client?: Client;
    /** Intervallo scelto a mano (già validato): sostituisce periodo e giorni, con la sua cache. */
    range?: DateRange;
}): Promise<ReportResult | null> {
    const { clientId, compare, refresh = false, runId, range } = opts;
    // Un intervallo personalizzato ha una voce di cache sua (le date fanno parte della chiave)
    const datePreset = range ? 'custom' : opts.datePreset;
    const daysRaw = range ? `${range.from}_${range.to}` : opts.daysRaw;
    const ref = cacheRef(clientId, reportCacheKey(datePreset, daysRaw, compare));

    if (!refresh) {
        const cached = await ref.get().catch(() => null);
        const hit = cached?.exists ? (cached.data() as any) : null;
        if (hit?.computedAt && Date.now() - Date.parse(hit.computedAt) < (hit.ttlMs ?? TTL_OK_MS)) {
            return { clientId, datePreset, compare, windows: hit.windows ?? null, platforms: hit.platforms as PlatformReport[], computedAt: hit.computedAt, cached: true };
        }
    }

    let client = opts.client;
    if (!client) {
        const snap = await adminDb.collection('clients').doc(clientId).get();
        if (!snap.exists) return null;
        client = snap.data() as Client;
    }

    const days = parseInt(daysRaw, 10);
    // Finestre esplicite solo per il confronto; senza, resta il percorso semplice con date_preset
    const windows = range
        ? buildRangeWindows(range.from, range.to, compare)   // sempre esplicite, anche senza confronto
        : Number.isFinite(days) && compare !== 'none' ? buildWindows(days, compare) : undefined;

    // La chiave Klaviyo vive cifrata nella sottocollection `integrations`: la si risolve qui così lib/reporting.ts non
    // dipende da Firestore. Un errore nel leggerla non deve far cadere il resto del report.
    const klaviyoToken = await getClientToken(clientId, 'klaviyo').catch(() => null);
    const klaviyo = klaviyoToken?.accessToken
        ? { apiKey: klaviyoToken.accessToken, conversionMetricId: klaviyoToken.extra?.conversionMetricId, cacheKey: clientId }
        : undefined;

    const write = runId ? makeProgressWriter(clientId, runId) : null;
    let last = { done: 0, total: 0, label: '', ok: true };
    const platforms = await getClientMarketingReport({ ...client, klaviyo }, datePreset, windows, {
        fresh: refresh,
        onProgress: write ? (e) => { last = e; void write(e); } : undefined,
    });
    if (write) await write({ ...last, done: last.total }, true);

    const computedAt = new Date().toISOString();
    await ref.set(forFirestore({ computedAt, ttlMs: ttlFor(platforms), windows: windows ?? null, platforms }))
        .catch((err: any) => console.error(`[report-service] cache non scritta per ${clientId}:`, err.message));

    return { clientId, datePreset, compare, windows: windows ?? null, platforms, computedAt, cached: false };
}
