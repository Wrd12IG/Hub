/**
 * GET /api/outreach/overview
 *
 * Quello che mostra la pagina Outreach: stato del ponte, email in coda, aziende, risposte e comandi in attesa.
 * Solo amministratori: sono dati di terze persone (indirizzi email, testi delle bozze).
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { forbiddenResponse, getAppUser, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { isAdminUser } from '@/lib/roles';
import { PARAM_ACTIONS } from '@/lib/outreach';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    if (!isAdminUser(await getAppUser(user.uid))) return forbiddenResponse();

    const [meta, outbox, companies, contacts, replies, commands, recent] = await Promise.all([
        adminDb.collection('outreachMeta').doc('current').get(),
        adminDb.collection('outreachOutbox').get(),
        adminDb.collection('outreachCompanies').get(),
        adminDb.collection('outreachContacts').get(),
        adminDb.collection('outreachReplies').get(),
        adminDb.collection('outreachCommands').where('status', '==', 'pending').get(),
        // Solo l'ordine per data (indice automatico): il filtro sul tipo si fa qui sotto, senza un indice composto da creare.
        adminDb.collection('outreachCommands').orderBy('requestedAt', 'desc').limit(40).get(),
    ]);

    return NextResponse.json({
        meta: meta.exists ? meta.data() : null,
        outbox: outbox.docs.map((d) => d.data()),
        companies: companies.docs.map((d) => d.data()),
        contacts: contacts.docs.map((d) => d.data()),
        replies: replies.docs.map((d) => d.data()),
        pending: commands.docs.map((d) => ({ outboxId: d.get('outboxId') ?? null, action: d.get('action'), domain: d.get('domain') ?? null, changes: d.get('changes') ?? null })),
        actions: recent.docs
            .filter((d) => PARAM_ACTIONS.includes(d.get('action')))
            .slice(0, 15)
            .map((d) => ({
                id: d.id,
                action: d.get('action'),
                status: d.get('status'),
                provider: d.get('provider') ?? null,
                cities: d.get('cities') ?? [],
                industries: d.get('industries') ?? [],
                maxSpend: d.get('maxSpend') ?? null,
                codes: d.get('codes') ?? [],
                signalStatus: d.get('signalStatus') ?? null,
                estimatedCost: d.get('estimatedCost') ?? null,
                result: d.get('result') ?? null,
                error: d.get('error') ?? null,
                used: d.get('used') === true,
                requestedAt: d.get('requestedAt') ?? null,
                appliedAt: d.get('appliedAt') ?? null,
            })),
    });
}
