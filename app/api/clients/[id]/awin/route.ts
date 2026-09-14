import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getAwinTotals, getAwinByPublisher, getAwinTransactionRows } from '@/lib/awin-client';

// Le transazioni si scaricano a blocchi di 31 giorni: su 90 sono tre chiamate.
export const maxDuration = 60;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/clients/[id]/awin
 *
 * Il dettaglio affiliazione: ripartizione per publisher — quali affiliati
 * portano fatturato e a che costo — più l'elenco delle transazioni.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(auth.uid, params.id);
  if (denied) return denied;

  const token = process.env.AWIN_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'AWIN_API_TOKEN non configurato sul server.' }, { status: 503 });
  }

  const snap = await adminDb.collection('clients').doc(params.id).get();
  const advertiserId = snap.exists ? (snap.data() as any)?.awinAdvertiserId : null;
  if (!advertiserId) {
    return NextResponse.json(
      { error: 'Questo cliente non ha un Advertiser ID Awin: inseriscilo in Setup API.' },
      { status: 503 }
    );
  }

  const raw = request.nextUrl.searchParams.get('days');
  const days = raw === '7' ? 7 : raw === '90' ? 90 : 30;
  const from = isoDaysAgo(days);
  const to = isoDaysAgo(0);

  try {
    // Le tre funzioni rileggono le stesse transazioni: su 30 giorni è una
    // chiamata ciascuna e costa poco, e tenerle separate rende ognuna
    // utilizzabile da sola. Se un giorno pesasse, si passa una sola fetch.
    const [totals, publishers, transactions] = await Promise.all([
      getAwinTotals(token, advertiserId, from, to),
      getAwinByPublisher(token, advertiserId, from, to),
      getAwinTransactionRows(token, advertiserId, from, to),
    ]);
    return NextResponse.json({ advertiserId, days, totals, publishers, transactions });
  } catch (err: any) {
    console.error(`[awin] dettaglio fallito per ${params.id}:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
}
