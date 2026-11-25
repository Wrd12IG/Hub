/**
 * GET /api/dealer-kpi/overview?month=AAAA-MM  (staff)
 *
 * Tutti i concessionari (profilo KPI «Auto e moto» o con uno Sheet collegato) affiancati per un mese: lead, appuntamenti,
 * preventivi, vendite, imbuto e ripartizione per marca e provenienza. Legge solo i dati già salvati dalla sincronizzazione
 * dello Sheet: nessuna chiamata a Meta, Google o Analytics, quindi è immediata anche con molti clienti.
 * Senza `month` restituisce solo l'elenco dei mesi disponibili.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { denyUnlessStaff, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { isArchivedClient } from '@/lib/client-archive';
import { isMonthKey } from '@/lib/manual-kpis';
import { buildOverview, type OverviewInput } from '@/lib/dealer-kpi/overview';
import type { MonthTotals } from '@/lib/dealer-kpi/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    const denied = await denyUnlessStaff(user.uid);
    if (denied) return denied;

    const month = request.nextUrl.searchParams.get('month');
    if (month !== null && !isMonthKey(month)) return NextResponse.json({ error: 'Mese non valido (AAAA-MM).' }, { status: 400 });

    try {
        const clients = await adminDb.collection('clients').get();
        const months = new Set<string>();
        const inputs: OverviewInput[] = [];
        await Promise.all(clients.docs.map(async (c) => {
            const data = c.data() as { name?: string; kpiProfile?: string | null; archived?: boolean | null };
            if (isArchivedClient(data)) return;
            const cfg = await c.ref.collection('private').doc('dealerSheet').get();
            if (!cfg.exists && data.kpiProfile !== 'auto') return;
            const status = (cfg.data() as { status?: { months?: string[] } } | undefined)?.status;
            for (const m of status?.months ?? []) if (isMonthKey(m)) months.add(m);
            if (!month) return;
            const snap = await c.ref.collection('dealerKpi').doc(month).get();
            const totals = snap.exists ? ((snap.data() as { totals?: MonthTotals }).totals ?? null) : null;
            inputs.push({ clientId: c.id, name: String(data.name ?? c.id), totals });
        }));
        const availableMonths = Array.from(months).sort();
        if (!month) return NextResponse.json({ availableMonths });
        return NextResponse.json({ availableMonths, overview: buildOverview(month, inputs) });
    } catch (e) {
        console.error('[dealer-kpi overview]', e);
        return NextResponse.json({ error: 'Errore nella lettura dei dati' }, { status: 500 });
    }
}
