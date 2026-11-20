/**
 * lib/site-monitor/service.ts
 *
 * Il collante usato dalle route: legge il cliente, lancia la scansione con le dipendenze vere e crea i task.
 * Solo server. La chiave Firecrawl è `SITE_MONITOR_FIRECRAWL_KEY` (una dedicata, non quella di Sellbird).
 */
import { budgetFromEnv } from './budget';
import { createFirecrawlClient } from './firecrawl';
import { checkUrl, fetchText } from './net';
import { scanSite, type ScanResult } from './scan';
import { firestoreStore, type FindingRecord, type MonitorState } from './store';
import { createTasksForFindings, firestoreTaskPort, type CreateTasksResult } from './tasks';

export const SCAN_INTERVAL_DAYS = 30;

export class MonitorConfigError extends Error {}

export interface ClientRunResult { scan: ScanResult['scan']; tasks: CreateTasksResult | null }

async function loadClient(clientId: string) {
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb.collection('clients').doc(clientId).get();
    if (!snap.exists) return null;
    return { name: String(snap.get('name') ?? clientId), websiteUrl: String(snap.get('websiteUrl') ?? '').trim() };
}

function normalizeSite(raw: string): string {
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

export async function runClientScan(clientId: string, opts: { dryRun?: boolean; createTasks?: boolean; now?: Date } = {}): Promise<ClientRunResult> {
    const apiKey = process.env.SITE_MONITOR_FIRECRAWL_KEY;
    if (!apiKey) throw new MonitorConfigError('SITE_MONITOR_FIRECRAWL_KEY non configurata');
    const client = await loadClient(clientId);
    if (!client) throw new MonitorConfigError('cliente non trovato');
    if (!client.websiteUrl) throw new MonitorConfigError('il cliente non ha un sito registrato');

    const now = opts.now ?? new Date();
    const store = await firestoreStore();
    const result = await scanSite(clientId, normalizeSite(client.websiteUrl), {
        firecrawl: createFirecrawlClient({ apiKey }), store, checkUrl, fetchText, budget: budgetFromEnv(), now, dryRun: opts.dryRun,
    });

    let tasks: CreateTasksResult | null = null;
    if (opts.createTasks && !opts.dryRun) {
        const state = await store.getState(clientId);
        tasks = await createTasksForFindings(clientId, client.name, result.findings, state?.assigneeIds ?? [], firestoreTaskPort(), now);
        if (tasks.updated.length) await store.saveFindings(clientId, tasks.updated);
    }
    return { scan: result.scan, tasks };
}

/** Crea i task per i problemi scelti a mano dalla pagina (stesse regole anti-doppione). */
export async function createTasksNow(clientId: string, fingerprints: string[] | undefined, now = new Date()): Promise<CreateTasksResult> {
    const client = await loadClient(clientId);
    if (!client) throw new MonitorConfigError('cliente non trovato');
    const store = await firestoreStore();
    const state = await store.getState(clientId);
    const records: FindingRecord[] = await store.getFindings(clientId);
    const res = await createTasksForFindings(clientId, client.name, records, state?.assigneeIds ?? [], firestoreTaskPort(), now, { only: fingerprints ? new Set(fingerprints) : undefined });
    if (res.updated.length) await store.saveFindings(clientId, res.updated);
    return res;
}

/** Clienti da scansionare oggi: con sito, non spenti, mai scansionati o ultima scansione oltre l'intervallo. Più vecchi per primi. */
export function dueClients(rows: Array<{ id: string; websiteUrl: string; state: MonitorState | null }>, now: Date): string[] {
    const limit = now.getTime() - SCAN_INTERVAL_DAYS * 86_400_000;
    return rows
        .filter((r) => r.websiteUrl.trim() && r.state?.enabled !== false && (!r.state?.lastScanAt || Date.parse(r.state.lastScanAt) <= limit))
        .sort((a, b) => Date.parse(a.state?.lastScanAt ?? '1970-01-01') - Date.parse(b.state?.lastScanAt ?? '1970-01-01'))
        .map((r) => r.id);
}
