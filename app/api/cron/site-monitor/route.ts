/**
 * GET /api/cron/site-monitor
 *
 * Ogni giorno prende fino a 3 clienti con il sito da controllare (cadenza mensile: l'ultima scansione ha più di 30 giorni), li scansiona
 * e crea i task per gli utenti designati. Si ferma al primo segnale di crediti finiti. Nessuna email ai clienti.
 */
import { NextRequest, NextResponse } from 'next/server';
import { denyUnlessCron } from '@/lib/cron-auth';
import { adminDb } from '@/lib/firebase-admin';
import { dueClients, MonitorConfigError, runClientScan } from '@/lib/site-monitor/service';
import type { MonitorState } from '@/lib/site-monitor/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PER_RUN = 3;

export async function GET(request: NextRequest) {
    const denied = denyUnlessCron(request, 'site-monitor');
    if (denied) return denied;

    const clients = await adminDb.collection('clients').get();
    const rows = await Promise.all(clients.docs.map(async (d) => {
        const s = await d.ref.collection('private').doc('siteMonitor').get();
        return { id: d.id, websiteUrl: String(d.get('websiteUrl') ?? ''), state: s.exists ? (s.data() as MonitorState) : null };
    }));
    const due = dueClients(rows, new Date()).slice(0, PER_RUN);

    const results: Array<{ clientId: string; status: string; tasks?: number; error?: string }> = [];
    for (const clientId of due) {
        try {
            const r = await runClientScan(clientId, { createTasks: true });
            results.push({ clientId, status: r.scan.status, tasks: r.tasks?.created });
            if (r.scan.status === 'budget_esaurito') break;
        } catch (e) {
            if (e instanceof MonitorConfigError) { results.push({ clientId, status: 'non_configurato', error: e.message }); if (/KEY/.test(e.message)) break; continue; }
            console.error('[cron site-monitor]', clientId, e);
            results.push({ clientId, status: 'errore' });
        }
    }
    return NextResponse.json({ success: true, due: due.length, results });
}
