/**
 * GET /api/clients/[id]/gbp
 *
 * Google Business Profile data.
 * - Se token non trovato → { configured: false }  (200, non 503)
 * - Se token trovato ma API non ancora implementata → { configured: true, apiPending: true }
 * - In futuro: dati reali da Google Business Profile API v4
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, getClientToken } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';

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
    // Location configured but no OAuth token → prompt to re-authorize
    return NextResponse.json({
      configured: true,
      apiPending: true,
      tokenMissing: true,
      _meta: {
        hint: 'Token GBP scaduto o mancante. Ri-autorizza da Setup API.',
      },
    });
  }

  // TODO: integrate real Google Business Profile API v4 call here
  // GET https://mybusinessbusinessinformation.googleapis.com/v1/{location}:getGoogleUpdated
  // For now: return configured:true with apiPending flag so UI shows correct "pending" state
  return NextResponse.json({
    configured: true,
    apiPending: true,
    _meta: {
      source: 'pending',
      hint: 'Integrazione GBP API in sviluppo. Dati reali disponibili presto.',
    },
  });
}
