/**
 * POST /api/outreach/outbox/[id]   { action: 'approve' | 'reject' }
 *
 * Non invia nulla e non tocca Sellbird: registra la decisione di un amministratore come comando.
 * Il ponte la ritira entro pochi minuti e la applica con `sellbird outbox --approve/--reject`.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { forbiddenResponse, getAppUser, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { isAdminUser } from '@/lib/roles';
import { isValidOutreachId, type OutreachAction } from '@/lib/outreach';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    if (!isAdminUser(await getAppUser(user.uid))) return forbiddenResponse();

    const { id } = params;
    if (!isValidOutreachId(id)) return NextResponse.json({ error: 'Id non valido' }, { status: 400 });

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON non valido' }, { status: 400 });
    }
    const action: OutreachAction | null = body?.action === 'approve' || body?.action === 'reject' ? body.action : null;
    if (!action) return NextResponse.json({ error: 'action deve essere approve o reject' }, { status: 400 });

    const item = await adminDb.collection('outreachOutbox').doc(id).get();
    if (!item.exists) return NextResponse.json({ error: 'Email non trovata' }, { status: 404 });
    const status = item.get('status');
    const allowed = action === 'approve' ? status === 'pending_review' : status === 'pending_review' || status === 'approved';
    if (!allowed) {
        return NextResponse.json({ error: `Con stato «${status}» non si può ${action === 'approve' ? 'approvare' : 'rifiutare'}.` }, { status: 409 });
    }

    const already = await adminDb.collection('outreachCommands').where('outboxId', '==', id).where('status', '==', 'pending').limit(1).get();
    if (!already.empty) return NextResponse.json({ error: 'C\'è già una richiesta in attesa per questa email.' }, { status: 409 });

    await adminDb.collection('outreachCommands').add({
        outboxId: id,
        action,
        status: 'pending',
        requestedBy: user.email ?? user.uid,
        requestedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
}
