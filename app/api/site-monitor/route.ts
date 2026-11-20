/**
 * GET /api/site-monitor
 *
 * L'elenco dei clienti con un sito registrato e lo stato del monitor di ciascuno (ultima scansione, crediti del mese, utenti designati).
 * Solo amministratori. Serve alla pagina «Monitor siti», che lancia la scansione cliente per cliente.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { forbiddenResponse, getAppUser, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { monthKey } from '@/lib/site-monitor/budget';
import type { MonitorState } from '@/lib/site-monitor/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    if ((await getAppUser(user.uid))?.role !== 'Amministratore') return forbiddenResponse();

    const clients = await adminDb.collection('clients').get();
    const rows = await Promise.all(clients.docs.map(async (d) => {
        const websiteUrl = String(d.get('websiteUrl') ?? '').trim();
        if (!websiteUrl) return null;
        const s = await d.ref.collection('private').doc('siteMonitor').get();
        const state = s.exists ? (s.data() as MonitorState) : null;
        return {
            id: d.id,
            name: String(d.get('name') ?? d.id),
            websiteUrl,
            enabled: state?.enabled !== false,
            lastScanAt: state?.lastScanAt ?? null,
            assignees: state?.assigneeIds?.length ?? 0,
            creditsMonth: state && state.month === monthKey(new Date()) ? state.creditsUsed : 0,
        };
    }));
    const month = monthKey(new Date());
    return NextResponse.json({
        clients: rows.filter((r): r is NonNullable<typeof r> => r !== null).sort((a, b) => a.name.localeCompare(b.name)),
        month,
        spentThisMonth: rows.reduce((a, r) => a + (r?.creditsMonth ?? 0), 0),
    });
}
