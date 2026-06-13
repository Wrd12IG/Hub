/**
 * GET  /api/clients/[id]/seo-reports  → Lista report SEO salvati
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
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10');

  try {
    // Read from Firestore (populated by completed audits)
    const query = await adminDb
      .collection('clients')
      .doc(clientId)
      .collection('seoReports')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    if (query.empty) {
      // Return empty array when no reports exist yet
      return NextResponse.json({
        reports: [],
        total: 0,
      });
    }

    const reports = query.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ reports, total: reports.length });
  } catch (error) {
    console.error(`[seo-reports] Error for client ${clientId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch SEO reports' }, { status: 500 });
  }
}
