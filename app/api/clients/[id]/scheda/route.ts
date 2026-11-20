/**
 * GET /api/clients/[id]/scheda?limit=50&before=<ISO>&pending=1
 *
 * La scheda del cliente per lo staff: dati non sensibili + registro delle interazioni. L'accesso è deciso dal server (amministratori su tutti,
 * responsabili e PM di backup sul proprio cliente). Il ruolo Cliente non passa.
 */
import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { firestoreSchedaDeps } from '@/lib/client-scheda/firestore-deps';
import { getScheda } from '@/lib/client-scheda/service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    const sp = request.nextUrl.searchParams;
    const limit = Number(sp.get('limit'));
    const before = sp.get('before');
    try {
        const r = await getScheda(firestoreSchedaDeps(), user.uid, params.id, {
            limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
            before: before && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(before) ? before : undefined,
            pendingOnly: sp.get('pending') === '1',
        });
        return NextResponse.json(r.body, { status: r.status });
    } catch (e) {
        console.error('[scheda GET]', e);
        return NextResponse.json({ error: 'Errore nel caricamento' }, { status: 500 });
    }
}
