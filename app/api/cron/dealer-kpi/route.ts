/**
 * GET /api/cron/dealer-kpi
 *
 * Ogni notte rilegge gli Sheet dei clienti che ne hanno uno collegato. Un errore su un cliente non ferma gli altri.
 */
import { NextRequest, NextResponse } from 'next/server';
import { denyUnlessCron } from '@/lib/cron-auth';
import { adminDb } from '@/lib/firebase-admin';
import { firestoreDealerStore } from '@/lib/dealer-kpi/firestore-store';
import { googleSheetsReader } from '@/lib/dealer-kpi/sheets';
import { syncClient } from '@/lib/dealer-kpi/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BUDGET_MS = 240_000;

export async function GET(request: NextRequest) {
    const denied = denyUnlessCron(request, 'cron/dealer-kpi');
    if (denied) return denied;
    const started = Date.now();
    const clients = await adminDb.collection('clients').get();
    const results: Array<{ clientId: string; status: string; message: string }> = [];
    for (const c of clients.docs) {
        if (Date.now() - started > BUDGET_MS) { results.push({ clientId: c.id, status: 'saltato', message: 'tempo esaurito: al prossimo giro' }); continue; }
        if (!(await firestoreDealerStore.getConfig(c.id))) continue;
        try {
            const s = await syncClient(c.id, { store: firestoreDealerStore, reader: googleSheetsReader, now: new Date() });
            results.push({ clientId: c.id, status: s.lastStatus, message: s.lastMessage });
        } catch (e) {
            console.error('[cron dealer-kpi]', c.id, e);
            results.push({ clientId: c.id, status: 'errore', message: 'errore imprevisto' });
        }
    }
    return NextResponse.json({ success: true, synced: results.length, results });
}
