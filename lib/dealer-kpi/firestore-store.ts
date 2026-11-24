/**
 * lib/dealer-kpi/firestore-store.ts
 *
 * Archivio Firestore (Admin SDK, solo server):
 *  - clients/{id}/private/dealerSheet : collegamento allo Sheet e stato dell'ultima sincronizzazione
 *  - clients/{id}/dealerKpi/{AAAA-MM} : i dati di un mese (voci e totali)
 */
import { adminDb } from '@/lib/firebase-admin';
import type { DealerStore, MonthDoc, SheetConfig, SyncStatus } from './sync';

const cfgRef = (clientId: string) => adminDb.collection('clients').doc(clientId).collection('private').doc('dealerSheet');
const monthsCol = (clientId: string) => adminDb.collection('clients').doc(clientId).collection('dealerKpi');

export const firestoreDealerStore: DealerStore = {
    async getConfig(clientId) {
        const s = await cfgRef(clientId).get();
        if (!s.exists) return null;
        const d = s.data() as SheetConfig & { status?: SyncStatus };
        return { spreadsheetId: d.spreadsheetId, tab: d.tab || 'Dati', status: d.status };
    },
    async saveStatus(clientId, status) {
        await cfgRef(clientId).set({ status }, { merge: true });
    },
    async replaceMonths(clientId, months: MonthDoc[]) {
        const keep = new Set(months.map((m) => m.month));
        const existing = await monthsCol(clientId).get();
        const batch = adminDb.batch();
        for (const d of existing.docs) if (!keep.has(d.id)) batch.delete(d.ref);
        for (const m of months) batch.set(monthsCol(clientId).doc(m.month), JSON.parse(JSON.stringify(m)));
        await batch.commit();
    },
};

export async function saveSheetConfig(clientId: string, cfg: SheetConfig): Promise<void> {
    await cfgRef(clientId).set({ spreadsheetId: cfg.spreadsheetId, tab: cfg.tab, status: null });
}
export async function removeSheetConfig(clientId: string): Promise<void> {
    await cfgRef(clientId).delete();
}
export async function loadMonthTotals(clientId: string) {
    const snap = await monthsCol(clientId).get();
    return snap.docs.map((d) => d.data().totals).filter(Boolean).sort((a, b) => String(a.month).localeCompare(String(b.month)));
}
