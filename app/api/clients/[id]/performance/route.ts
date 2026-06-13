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

    // TODO: Phase 4 Migration - Connect to Google Ads and Meta APIs
    // For now, return a successful empty/mock payload to keep the frontend running smoothly
    return NextResponse.json({
      ok: true,
      message: 'Performance API migration in progress',
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
