/**
 * POST /api/outreach/sending   { action: 'pause' | 'resume' }
 *
 * Ferma o riprende tutti gli invii di Sellbird. Come per approva/rifiuta, non tocca Sellbird: registra un comando
 * che il ponte applica con `sellbird sending pause|resume`. Solo amministratori.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { forbiddenResponse, getAppUser, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { isAdminUser } from '@/lib/roles';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    if (!isAdminUser(await getAppUser(user.uid))) return forbiddenResponse();

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON non valido' }, { status: 400 });
    }
    const action = body?.action === 'pause' ? 'pause_sending' : body?.action === 'resume' ? 'resume_sending' : null;
    if (!action) return NextResponse.json({ error: 'action deve essere pause o resume' }, { status: 400 });

    // Una sola richiesta di pausa/ripresa alla volta: la seconda arriverebbe prima che il ponte abbia applicato la prima.
    for (const a of ['pause_sending', 'resume_sending']) {
        const pending = await adminDb.collection('outreachCommands').where('action', '==', a).where('status', '==', 'pending').limit(1).get();
        if (!pending.empty) return NextResponse.json({ error: 'C\'è già una richiesta in attesa: Sellbird la applica entro pochi minuti.' }, { status: 409 });
    }

    await adminDb.collection('outreachCommands').add({
        action,
        status: 'pending',
        requestedBy: user.email ?? user.uid,
        requestedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
}
