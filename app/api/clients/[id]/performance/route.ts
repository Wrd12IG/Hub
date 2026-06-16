import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  try {
    const id = params.id;
    
    // First, verify the client exists
    const docRef = adminDb.collection('clients').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const daysBack = parseInt(request.nextUrl.searchParams.get('daysBack') || '30', 10);

    // Phase 4 TODO: Connect real Google Ads and Meta APIs
    // Stub returns empty aggregates — frontend hides widgets when all zeros
    return NextResponse.json({
      ok: true,
      daysBack,
      message: 'Performance API — real data integration pending',
      summary: {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0
      },
      campaigns: []
    });


  } catch (error) {
    console.error(`Error fetching performance for client ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to fetch performance data' }, { status: 500 });
  }
}
