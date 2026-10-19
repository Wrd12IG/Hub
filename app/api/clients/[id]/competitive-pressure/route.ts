import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getGoogleAdsCompetitivePressure } from '@/lib/google-ads-client';
import { validateRange } from '@/lib/date-range';

export const maxDuration = 60;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/clients/[id]/competitive-pressure
 *
 * L'unico dato competitivo numerico che le API espongano: quanta parte delle
 * ricerche disponibili stiamo prendendo, e perché perdiamo il resto.
 *
 * I nomi dei concorrenti non ci sono e non sono ottenibili — Google li mostra
 * solo nella propria interfaccia. Il monitoraggio dei siti competitor, che è
 * un'altra cosa, sta in /competitors.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(auth.uid, params.id);
  if (denied) return denied;

  const snap = await adminDb.collection('clients').doc(params.id).get();
  const customerId = snap.exists ? (snap.data() as any)?.googleAdAccountId : null;
  if (!customerId) {
    return NextResponse.json(
      { notConfigured: true, error: 'Serve un ID account Google Ads per misurare la pressione competitiva.' },
      { status: 503 }
    );
  }

  const raw = request.nextUrl.searchParams.get('days');
  const days = raw === '7' ? 7 : raw === '90' ? 90 : 30;

  // Intervallo scelto a mano (?from=&to=), validato come per il report
  const sp = request.nextUrl.searchParams;
  const check = sp.has('from') || sp.has('to') ? validateRange(sp.get('from'), sp.get('to')) : null;
  if (check && !check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  try {
    const pressure = check?.ok
      ? await getGoogleAdsCompetitivePressure(customerId, check.range.from, check.range.to)
      : await getGoogleAdsCompetitivePressure(customerId, isoDaysAgo(days), isoDaysAgo(0));
    return NextResponse.json({ ...pressure, days: check?.ok ? check.days : days });
  } catch (err: any) {
    console.error(`[competitive-pressure] fallita per ${params.id}:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
}
