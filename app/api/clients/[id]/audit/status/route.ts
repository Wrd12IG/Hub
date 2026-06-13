/**
 * GET /api/clients/[id]/audit/status
 * Controlla lo stato dell'ultimo SEO audit del cliente
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;
  const auditId = request.nextUrl.searchParams.get('auditId');

  try {
    let snap;

    if (auditId) {
      // Get specific audit
      snap = await adminDb
        .collection('clients')
        .doc(clientId)
        .collection('audits')
        .doc(auditId)
        .get();

      if (!snap.exists) {
        return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
      }

      return NextResponse.json({ id: snap.id, ...snap.data() });
    } else {
      // Get latest audit
      const query = await adminDb
        .collection('clients')
        .doc(clientId)
        .collection('audits')
        .orderBy('startedAt', 'desc')
        .limit(1)
        .get();

      if (query.empty) {
        return NextResponse.json({
          status: 'none',
          message: 'Nessun audit eseguito. Avvia il primo audit.',
        });
      }

      const doc = query.docs[0];
      return NextResponse.json({ id: doc.id, ...doc.data() });
    }
  } catch (error) {
    console.error(`[audit/status] Error for client ${clientId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch audit status' }, { status: 500 });
  }
}
