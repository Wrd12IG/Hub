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
    // Map daysBack to datePreset expected from n8n
    const datePreset = daysBack === 7 ? 'last_7d' : daysBack === 30 ? 'last_30d' : 'this_month';

    // Fetch the stored performance data sent by n8n
    const performanceSnapshot = await adminDb
      .collection('clients')
      .doc(id)
      .collection('performance')
      .where('datePreset', '==', datePreset)
      .get();

    const performanceData: any = {
      ok: true,
      daysBack,
      meta: null,
      google: null,
      tiktok: null,
      youtube: null,
      gbp: null,
      instagram_organic: null
    };

    performanceSnapshot.forEach(doc => {
      const data = doc.data();
      // Map platform names to the frontend's expected keys
      if (data.platform === 'facebook' || data.platform === 'meta') {
        performanceData.meta = data.data;
      } else if (data.platform === 'google_ads' || data.platform === 'google') {
        performanceData.google = data.data;
      } else {
        performanceData[data.platform] = data.data;
      }
    });

    return NextResponse.json(performanceData);
  } catch (error) {
    console.error(`Error fetching performance for client ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to fetch performance data' }, { status: 500 });
  }
}
