/**
 * GET /api/clients/[id]/dealer-kpi/kpis?month=AAAA-MM  (staff)
 *
 * I KPI del concessionario per un mese: sito (sessioni, utenti), Meta Ads, Google Ads, Google Maps, dati dello Sheet del cliente e
 * costo per lead calcolato, ognuno con il confronto sul mese prima e sullo stesso mese dell'anno scorso.
 * Legge le piattaforme (può richiedere qualche secondo) e NON salva nulla: la fotografia della mail mensile non viene toccata.
 */
import { NextRequest, NextResponse } from 'next/server';
import { denyUnlessStaff, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { DEALER_KPI_GROUPS, DEALER_KPI_IDS } from '@/lib/kpi-profiles';
import { computeClientMonth } from '@/lib/kpi-monthly';
import { isMonthKey } from '@/lib/manual-kpis';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    const denied = await denyUnlessStaff(user.uid);
    if (denied) return denied;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(params.id)) return NextResponse.json({ error: 'Cliente non valido' }, { status: 400 });
    const month = request.nextUrl.searchParams.get('month');
    if (!isMonthKey(month)) return NextResponse.json({ error: 'Mese non valido (AAAA-MM).' }, { status: 400 });
    try {
        const out = await computeClientMonth(params.id, month, { kpiIds: DEALER_KPI_IDS, weeks: false, snapshot: false });
        if (!out.ok) return NextResponse.json({ error: out.message }, { status: out.reason === 'not_found' ? 404 : 422 });
        const { kpis, alerts, partial } = out.result;
        return NextResponse.json({ month, groups: DEALER_KPI_GROUPS, kpis, alerts, partial: partial ?? null });
    } catch (e) {
        console.error('[dealer-kpi kpis]', e);
        return NextResponse.json({ error: 'Errore nella lettura dei dati' }, { status: 500 });
    }
}
