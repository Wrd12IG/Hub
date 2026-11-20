/** POST /api/clients/[id]/scheda/log  { type, text, requestApproval? } — nuova riga nel registro. La data la mette il server. */
import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { firestoreSchedaDeps } from '@/lib/client-scheda/firestore-deps';
import { addEntry } from '@/lib/client-scheda/service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    try {
        const r = await addEntry(firestoreSchedaDeps(), user.uid, params.id, await request.json().catch(() => null));
        return NextResponse.json(r.body, { status: r.status });
    } catch (e) {
        console.error('[scheda log POST]', e);
        return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 });
    }
}
