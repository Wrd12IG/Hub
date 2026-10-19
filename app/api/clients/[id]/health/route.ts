import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { getHealth } from '@/lib/health-service';

// Il verdetto richiede il report su due finestre (corrente e precedente), che significa il doppio delle chiamate alle
// piattaforme. Il tetto per singola piattaforma sta in lib/reporting.ts; questo è quello complessivo.
export const maxDuration = 60;

/**
 * GET /api/clients/[id]/health
 *
 * Come sta andando questo cliente, in una faccia e un numero. Il calcolo e la cache (6 ore su
 * clients/{id}/cache/health2) stanno in lib/health-service.ts: li usa anche il giro notturno. `?refresh=1` scavalca la cache.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    const denied = await denyUnlessClientAllowed(auth.uid, params.id);
    if (denied) return denied;

    try {
        const health = await getHealth(params.id, request.nextUrl.searchParams.get('refresh') === '1');
        if (!health) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        return NextResponse.json(health);
    } catch (err: any) {
        console.error(`[health] calcolo fallito per ${params.id}:`, err.message);
        return NextResponse.json({ error: err.message }, { status: 503 });
    }
}
