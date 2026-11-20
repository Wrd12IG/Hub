/**
 * lib/site-monitor/store.ts
 *
 * Dove si salvano i risultati. Un'interfaccia (per i test, con una versione in memoria) e la versione Firestore.
 * Percorsi: clients/{id}/private/siteMonitor (impostazioni e crediti del mese), clients/{id}/siteScans/{scanId}, clients/{id}/siteFindings/{fingerprint}.
 * Si scrive solo dal server (admin SDK): il browser non tocca queste raccolte.
 */
import type { Finding } from './types';

export type FindingStatus = 'nuovo' | 'task_creato' | 'ignorato' | 'risolto';

export interface FindingRecord extends Finding {
    fingerprint: string;
    status: FindingStatus;
    firstSeen: string;
    lastSeen: string;
    scanId: string;
    taskId?: string;
}

export interface ScanRecord {
    id: string;
    startedAt: string;
    status: 'ok' | 'parziale' | 'budget_esaurito' | 'errore';
    pagesScanned: number;
    creditsUsed: number;
    findingsNew: number;
    findingsOpen: number;
    findingsResolved: number;
    note?: string;
}

export interface MonitorState {
    /** Mese (AAAA-MM) a cui si riferisce `creditsUsed`. */
    month: string;
    creditsUsed: number;
    lastScanAt?: string;
    /** Spento = il cron lo salta. Assente = acceso. */
    enabled?: boolean;
    /** Utenti a cui assegnare i task (a turno). Vuoto = nessun task. */
    assigneeIds?: string[];
}

export interface SiteMonitorStore {
    getState(clientId: string): Promise<MonitorState | null>;
    saveState(clientId: string, state: MonitorState): Promise<void>;
    getFindings(clientId: string): Promise<FindingRecord[]>;
    saveFindings(clientId: string, findings: FindingRecord[]): Promise<void>;
    saveScan(clientId: string, scan: ScanRecord): Promise<void>;
}

export function memoryStore(): SiteMonitorStore & { scans: Map<string, ScanRecord[]>; findings: Map<string, Map<string, FindingRecord>>; states: Map<string, MonitorState> } {
    const states = new Map<string, MonitorState>();
    const findings = new Map<string, Map<string, FindingRecord>>();
    const scans = new Map<string, ScanRecord[]>();
    return {
        states, findings, scans,
        async getState(c) { return states.get(c) ?? null; },
        async saveState(c, s) { states.set(c, { ...(states.get(c) ?? { month: s.month, creditsUsed: 0 }), ...s }); },
        async getFindings(c) { return Array.from((findings.get(c) ?? new Map()).values()); },
        async saveFindings(c, list) {
            const m = findings.get(c) ?? new Map<string, FindingRecord>();
            for (const f of list) m.set(f.fingerprint, f);
            findings.set(c, m);
        },
        async saveScan(c, s) { scans.set(c, [...(scans.get(c) ?? []), s]); },
    };
}

/** Versione Firestore. Import dinamico: i test e i moduli puri non caricano firebase-admin. */
export async function firestoreStore(): Promise<SiteMonitorStore> {
    const { adminDb } = await import('@/lib/firebase-admin');
    const col = (c: string, name: string) => adminDb.collection('clients').doc(c).collection(name);
    const stateRef = (c: string) => col(c, 'private').doc('siteMonitor');
    return {
        async getState(c) { const s = await stateRef(c).get(); return s.exists ? (s.data() as MonitorState) : null; },
        async saveState(c, s) { await stateRef(c).set(s, { merge: true }); },
        async getFindings(c) { const s = await col(c, 'siteFindings').get(); return s.docs.map((d) => d.data() as FindingRecord); },
        async saveFindings(c, list) {
            for (let i = 0; i < list.length; i += 400) {
                const batch = adminDb.batch();
                for (const f of list.slice(i, i + 400)) batch.set(col(c, 'siteFindings').doc(f.fingerprint), f, { merge: true });
                await batch.commit();
            }
        },
        async saveScan(c, s) { await col(c, 'siteScans').doc(s.id).set(s); },
    };
}
