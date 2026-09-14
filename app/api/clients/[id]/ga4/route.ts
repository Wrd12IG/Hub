import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getGA4Totals, getGA4Breakdown, getGA4EcommerceEvents } from '@/lib/ga4-client';

export const maxDuration = 60;

/**
 * GET /api/clients/[id]/ga4
 *
 * Il dettaglio del traffico: da dove arriva, cosa guarda, con che dispositivo,
 * da quale paese — più gli eventi e-commerce. Sono i tagli che la scheda nella
 * Overview non può mostrare, e che nella vecchia dashboard c'erano solo per
 * sorgente/mezzo.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(auth.uid, params.id);
  if (denied) return denied;

  const snap = await adminDb.collection('clients').doc(params.id).get();
  const propertyId = snap.exists ? (snap.data() as any)?.ga4PropertyId : null;
  if (!propertyId) {
    return NextResponse.json(
      { error: 'Questo cliente non ha un GA4 Property ID: inseriscilo in Setup API.' },
      { status: 503 }
    );
  }

  const raw = request.nextUrl.searchParams.get('days');
  const days = raw === '7' ? 7 : raw === '90' ? 90 : 30;
  const startDate = `${days}daysAgo`;
  const endDate = 'today';

  try {
    const [totals, channels, sources, pages, devices, countries, events] = await Promise.all([
      getGA4Totals(propertyId, startDate, endDate),
      getGA4Breakdown(propertyId, startDate, endDate, 'sessionDefaultChannelGroup', 15),
      getGA4Breakdown(propertyId, startDate, endDate, 'sessionSourceMedium', 25),
      getGA4Breakdown(propertyId, startDate, endDate, 'pagePath', 25),
      getGA4Breakdown(propertyId, startDate, endDate, 'deviceCategory', 10),
      getGA4Breakdown(propertyId, startDate, endDate, 'country', 15),
      // Non tutti i siti sono e-commerce: se manca il tracciamento la sezione
      // sparisce invece di mostrare una tabella vuota.
      getGA4EcommerceEvents(propertyId, startDate, endDate).catch(() => []),
    ]);
    return NextResponse.json({ propertyId, days, totals, channels, sources, pages, devices, countries, events });
  } catch (err: any) {
    console.error(`[ga4] dettaglio fallito per ${params.id}:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
}
