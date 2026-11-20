/** POST /api/clients/[id]/scheda/log/[logId]/decision  { decision: 'approvata' | 'rifiutata', comment? } — solo amministratori. */
import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { firestoreSchedaDeps } from '@/lib/client-scheda/firestore-deps';
import { decideEntry } from '@/lib/client-scheda/service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string; logId: string } }) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(params.logId)) return NextResponse.json({ error: 'Riga non valida' }, { status: 400 });
    try {
        const r = await decideEntry(firestoreSchedaDeps(), user.uid, params.id, params.logId, await request.json().catch(() => null));
        return NextResponse.json(r.body, { status: r.status });
    } catch (e) {
        console.error('[scheda decision POST]', e);
        return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 });
    }
}
