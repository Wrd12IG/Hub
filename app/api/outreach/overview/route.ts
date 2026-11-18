/**
 * GET /api/outreach/overview
 *
 * Quello che mostra la pagina Outreach: stato del ponte, email in coda, aziende, risposte e comandi in attesa.
 * Solo amministratori: sono dati di terze persone (indirizzi email, testi delle bozze).
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { forbiddenResponse, getAppUser, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    if ((await getAppUser(user.uid))?.role !== 'Amministratore') return forbiddenResponse();

    const [meta, outbox, companies, replies, commands] = await Promise.all([
        adminDb.collection('outreachMeta').doc('current').get(),
        adminDb.collection('outreachOutbox').get(),
        adminDb.collection('outreachCompanies').get(),
        adminDb.collection('outreachReplies').get(),
        adminDb.collection('outreachCommands').where('status', '==', 'pending').get(),
    ]);

    return NextResponse.json({
        meta: meta.exists ? meta.data() : null,
        outbox: outbox.docs.map((d) => d.data()),
        companies: companies.docs.map((d) => d.data()),
        replies: replies.docs.map((d) => d.data()),
        pending: commands.docs.map((d) => ({ outboxId: d.get('outboxId') ?? null, action: d.get('action') })),
    });
}
