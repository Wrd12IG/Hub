/**
 * POST /api/outreach/exclusions   { changes: [{ action: 'add' | 'remove', domain }, ...] }   (anche la forma singola { action, domain })
 *
 * «Escludi» / «Riammetti» una o più aziende: mette i domini nella lista «mai contattare» di Sellbird, o li toglie. Le modifiche
 * arrivano **insieme** (la pagina le segna e poi le manda): un solo comando, che il ponte applica con una sola modifica del file
 * di configurazione (copia di sicurezza e verifica) e, per le esclusioni, rifiutando le bozze in coda di quei domini.
 * Non tocca Sellbird direttamente. Solo amministratori.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { forbiddenResponse, getAppUser, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { isAdminUser } from '@/lib/roles';
import { buildExclusionBatch, cleanDomain, parseExclusions } from '@/lib/outreach-exclusions';

export const dynamic = 'force-dynamic';

/** Firestore accetta al massimo 30 valori in un `in`. */
async function knownDomains(domains: string[]): Promise<Set<string>> {
    const found = new Set<string>();
    for (let i = 0; i < domains.length; i += 30) {
        const snap = await adminDb.collection('outreachCompanies').where('domain', 'in', domains.slice(i, i + 30)).get();
        snap.docs.forEach((d) => found.add(String(d.get('domain') ?? '').toLowerCase()));
    }
    return found;
}

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
    // La forma singola di prima diventa un gruppo di una modifica.
    if (!Array.isArray(body?.changes) && body?.action) body = { changes: [{ action: body.action, domain: body.domain }] };

    const asked = Array.isArray(body?.changes) ? body.changes : [];
    const toAdd: string[] = Array.from(new Set<string>(asked.filter((c: any) => c?.action === 'add').map((c: any) => cleanDomain(c?.domain)).filter((d: string | null): d is string => !!d)));

    const [meta, pending, known] = await Promise.all([
        adminDb.collection('outreachMeta').doc('current').get(),
        adminDb.collection('outreachCommands').where('status', '==', 'pending').get(),
        toAdd.length ? knownDomains(toAdd) : Promise.resolve(new Set<string>()),
    ]);
    // Un gruppo alla volta: un secondo arriverebbe prima che il ponte abbia finito il primo.
    if (pending.docs.some((d) => String(d.get('action') ?? '').startsWith('dnc_'))) {
        return NextResponse.json({ error: 'C\'è già un gruppo di modifiche in attesa: Sellbird lo applica a momenti.' }, { status: 409 });
    }

    const built = buildExclusionBatch(body, { knownDomains: known, exclusions: parseExclusions(meta.get('exclusions')) });
    if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });

    await adminDb.collection('outreachCommands').add({
        action: 'dnc_batch',
        changes: built.changes,
        status: 'pending',
        requestedBy: user.email ?? user.uid,
        requestedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, applied: built.changes.length, skipped: built.skipped });
}
