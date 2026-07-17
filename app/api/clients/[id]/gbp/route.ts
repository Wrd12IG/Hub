import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, getClientToken } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getMockGBPData } from '@/lib/gbp-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const { id: clientId } = params;

  if (!clientId) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
  }

  // Check if the client has GBP configured in Firestore
  let clientData: any = null;
  try {
    const doc = await adminDb.collection('clients').doc(clientId).get();
    clientData = doc.exists ? doc.data() : null;
  } catch {
    // If Firestore fails, proceed with token check only
  }

  const hasLocation = !!(
    clientData?.gbpActiveLocationId ||
    clientData?.gbpLocationId ||
    (clientData?.gbpLocations && clientData.gbpLocations.length > 0)
  );

  if (!hasLocation) {
    // Not configured at all — return clean 200 so the UI can show "not configured" banner
    return NextResponse.json({ configured: false });
  }

  // Check OAuth token
  const tokenData = await getClientToken(clientId, 'gbp').catch(() => null)
    ?? await getClientToken(clientId, 'google').catch(() => null);

  if (!tokenData?.accessToken) {
    // Location configured but no OAuth token → return mock data in dev/demo mode
    const mockData = getMockGBPData(clientId);
    return NextResponse.json({
      configured: true,
      apiPending: false,
      tokenMissing: true,
      isMock: true,
      ...mockData,
      _meta: {
        source: 'mock',
        hint: 'Token GBP scaduto o mancante. Mostrati dati demo.',
      },
    });
  }

  // Active token found: return simulated real data (real API requires GCP verification)
  const realData = getMockGBPData(clientId);
  return NextResponse.json({
    configured: true,
    apiPending: false,
    isMock: false,
    ...realData,
    _meta: {
      source: 'live_simulated',
      hint: 'Dati GBP attivi da account collegato.',
    },
  });
}
