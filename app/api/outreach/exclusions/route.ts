/**
 * POST /api/outreach/exclusions   { action: 'add' | 'remove', domain }
 *
 * «Escludi» / «Riammetti» un'azienda: mette il dominio nella lista «mai contattare» di Sellbird, o lo toglie. Non tocca Sellbird:
 * registra un comando che il ponte applica (modifica il file di configurazione con una copia di sicurezza e, per «escludi», rifiuta
 * le bozze in coda di quel dominio). Solo amministratori.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { forbiddenResponse, getAppUser, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { buildExclusionCommand, cleanDomain, parseExclusions } from '@/lib/outreach-exclusions';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    if ((await getAppUser(user.uid))?.role !== 'Amministratore') return forbiddenResponse();

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON non valido' }, { status: 400 });
    }

    const domain = cleanDomain(body?.domain);
    if (!domain) return NextResponse.json({ error: 'Dominio non valido.' }, { status: 400 });

    const [meta, company, same] = await Promise.all([
        adminDb.collection('outreachMeta').doc('current').get(),
        adminDb.collection('outreachCompanies').where('domain', '==', domain).limit(1).get(),
        adminDb.collection('outreachCommands').where('domain', '==', domain).where('status', '==', 'pending').limit(1).get(),
    ]);
    if (!same.empty) return NextResponse.json({ error: 'C\'è già una richiesta in attesa per questo dominio.' }, { status: 409 });

    const built = buildExclusionCommand(body, { knownCompany: !company.empty, exclusions: parseExclusions(meta.get('exclusions')) });
    if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });

    await adminDb.collection('outreachCommands').add({
        ...built.command,
        status: 'pending',
        requestedBy: user.email ?? user.uid,
        requestedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
}
