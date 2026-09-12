/**
 * GET  /api/clients/[id]/analytics     → GA4 numbers for the "Performance Dominio" panel
 *
 * Sourced from Windsor.ai using the client's GA4 Property ID. The Hub's own
 * lib/ga4-client.ts path is not used here: it needs a per-client Google OAuth
 * token that in practice almost no client has (only the Property ID ever gets
 * mapped), and it returned {summary, chartData, topPages, trafficSources} —
 * a different shape from the {traffic, behavior, conversions} the panel reads,
 * so that panel could not have worked even where the OAuth existed.
 *
 * No GA4 Property ID → 503 with notConfigured:true (never invented data).
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser, ownsClientResource } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getGA4Overview, buildWindows, type CompareMode } from '@/lib/reporting';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  const { id: clientId } = params;
  const user = await getAppUser(auth.uid);
  if (!isStaffUser(user) && !ownsClientResource(user, clientId)) return forbiddenResponse();

  const rangeParam = request.nextUrl.searchParams.get('dateRange') || '30d';
  const days = parseInt(rangeParam.replace('d', '')) || 30;
  const compare = (request.nextUrl.searchParams.get('compare') || 'prev_period') as CompareMode;

  try {
    const snap = await adminDb.collection('clients').doc(clientId).get();
    const propertyId = snap.exists ? (snap.data() as any)?.ga4PropertyId : null;

    if (!propertyId) {
      return NextResponse.json(
        {
          notConfigured: true,
          error: 'GA4 Property ID non configurato per questo cliente.',
          _meta: { source: 'empty', hint: 'Vai su Setup API e inserisci il GA4 Property ID.' },
        },
        { status: 503 }
      );
    }

    const analytics = await getGA4Overview(propertyId, buildWindows(days, compare));
    return NextResponse.json({ ...analytics, _meta: { source: 'windsor', days, compare } });
  } catch (error: any) {
    console.error(`[analytics] GA4 overview failed for client ${clientId}:`, error.message);
    return NextResponse.json(
      { notConfigured: true, error: error.message, _meta: { source: 'error' } },
      { status: 503 }
    );
  }
}
