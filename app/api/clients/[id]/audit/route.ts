/**
 * POST /api/clients/[id]/audit        → Avvia un nuovo SEO audit
 * GET  /api/clients/[id]/audit/status → Controlla lo stato dell'ultimo audit
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

// ── POST: Start audit ──────────────────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;

  try {
    const body = await request.json().catch(() => ({}));
    const { url, scope = 'full' } = body as { url?: string; scope?: string };

    // Create audit record in Firestore
    const auditRef = await adminDb
      .collection('clients')
      .doc(clientId)
      .collection('audits')
      .add({
        status: 'pending',
        scope,
        url: url || null,
        requestedBy: user.uid,
        startedAt: new Date().toISOString(),
        completedAt: null,
        results: null,
      });

    // TODO: Trigger actual SEO audit (e.g., Screaming Frog API, Ahrefs, custom crawler)
    // For now, simulate async completion after 5 seconds
    // In production: publish to a queue (Cloud Tasks, Inngest, etc.)

    return NextResponse.json({
      auditId: auditRef.id,
      status: 'pending',
      message: 'Audit avviato. Controlla lo stato con GET /api/clients/{id}/audit/status',
    });
  } catch (error) {
    console.error(`[audit] Error starting audit for client ${clientId}:`, error);
    return NextResponse.json({ error: 'Failed to start audit' }, { status: 500 });
  }
}
