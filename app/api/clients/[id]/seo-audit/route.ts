/**
 * GET  /api/clients/[id]/seo-audit  → l'ultimo audit salvato
 * POST /api/clients/[id]/seo-audit  → esegue un audit nuovo e lo salva
 *
 * Sostituisce il vecchio flusso, che non poteva funzionare: il modal inviava a
 * /api/clients/[id]/seo-reports/generate-document, una route inesistente (404),
 * e il report mostrato era comunque un mockup con numeri scritti a mano.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser, ownsClientResource } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { runSeoAudit } from '@/lib/seo-audit';

// PageSpeed takes ~25s on a real site, so this can't answer within the default
// serverless window. If the platform plan caps below this, the POST will be
// killed mid-run — the GET of the last saved audit keeps working regardless.
export const maxDuration = 60;

async function authorize(request: NextRequest, clientId: string) {
    const auth = await verifyAuth(request);
    if (!auth) return { error: unauthorizedResponse() };
    const user = await getAppUser(auth.uid);
    if (!isStaffUser(user) && !ownsClientResource(user, clientId)) return { error: forbiddenResponse() };
    return { uid: auth.uid };
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const clientId = params.id;
    const gate = await authorize(request, clientId);
    if (gate.error) return gate.error;

    const snap = await adminDb
        .collection('clients').doc(clientId)
        .collection('seoAudits')
        .orderBy('ranAt', 'desc')
        .limit(1)
        .get();

    if (snap.empty) return NextResponse.json({ audit: null });
    return NextResponse.json({ audit: snap.docs[0].data() });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    const clientId = params.id;
    const gate = await authorize(request, clientId);
    if (gate.error) return gate.error;
    // Running an audit costs an external API call and writes a record: staff only.
    const user = await getAppUser(gate.uid!);
    if (!isStaffUser(user)) return forbiddenResponse();

    try {
        const clientSnap = await adminDb.collection('clients').doc(clientId).get();
        if (!clientSnap.exists) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        const client = clientSnap.data() as any;

        const url: string = client?.websiteUrl || '';
        if (!url) {
            return NextResponse.json(
                { error: 'Questo cliente non ha un sito web configurato. Aggiungilo nella scheda cliente.' },
                { status: 400 }
            );
        }

        const audit = await runSeoAudit(url, client?.windsorAccounts?.searchconsole);

        await Promise.all([
            adminDb.collection('clients').doc(clientId).collection('seoAudits').add(audit),
            // Denormalised onto the client so the Overview card can show the
            // score without reading the subcollection.
            adminDb.collection('clients').doc(clientId).update({
                lastSeoScore: audit.score,
                lastSeoAuditAt: audit.ranAt,
            }),
        ]);

        return NextResponse.json({ audit });
    } catch (error: any) {
        console.error(`[seo-audit] failed for client ${clientId}:`, error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
