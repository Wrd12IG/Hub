import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed, getClientToken } from '@/lib/api-auth';
import { getKlaviyoBreakdown, presetToKlaviyoTimeframe } from '@/lib/klaviyo-client';

// Due report più i due elenchi nomi: il limite di Klaviyo è 2 report al
// minuto, quindi ci stiamo esatti — ma serve tempo, non fretta.
export const maxDuration = 60;

/**
 * GET /api/clients/[id]/klaviyo-detail
 *
 * Campagne e flussi riga per riga.
 *
 * ⚠️ Costa **due** chiamate ai report (una per campagne, una per flussi), che
 * è esattamente il budget di un minuto. Vanno in sequenza, non in parallelo:
 * due simultanee sfondano il burst di 1/s. Gli elenchi dei nomi usano
 * endpoint diversi e non pesano su quel limite.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(auth.uid, params.id);
  if (denied) return denied;

  const token = await getClientToken(params.id, 'klaviyo').catch(() => null);
  if (!token?.accessToken) {
    return NextResponse.json(
      { error: 'Klaviyo non è collegato per questo cliente: inserisci la chiave API in Setup API.' },
      { status: 503 }
    );
  }
  const metricId = token.extra?.conversionMetricId;
  if (!metricId) {
    return NextResponse.json(
      { error: 'Nessuna metrica di conversione "Placed Order" su questo account Klaviyo: il dettaglio non può calcolare il fatturato.' },
      { status: 503 }
    );
  }

  const raw = request.nextUrl.searchParams.get('days');
  const preset = raw === '7' ? 'last_7d' : raw === '90' ? 'last_90d' : 'last_30d';
  const timeframe = presetToKlaviyoTimeframe(preset);

  try {
    const campaigns = await getKlaviyoBreakdown(token.accessToken, metricId, timeframe, 'campaign', params.id);
    const flows = await getKlaviyoBreakdown(token.accessToken, metricId, timeframe, 'flow', params.id);
    return NextResponse.json({ accountName: token.extra?.accountName ?? null, campaigns, flows });
  } catch (err: any) {
    console.error(`[klaviyo-detail] fallita per ${params.id}:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
}
