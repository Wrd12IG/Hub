import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getSearchConsoleTotals, getSearchConsoleBreakdown } from '@/lib/search-console-client';

// Quattro dimensioni più i totali: cinque chiamate a Google, tutte veloci e
// senza rate limit stretti come Klaviyo. Il tetto esplicito c'è comunque.
export const maxDuration = 60;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/clients/[id]/search-console
 *
 * Il dettaglio che la scheda nella Overview non può mostrare: **quali query**
 * portano traffico, **quali pagine** lo ricevono, da quali dispositivi e paesi.
 * Sono le dimensioni vere della Search Console, che il connector Windsor non
 * esponeva affatto — è il motivo per cui siamo passati all'API nativa.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(auth.uid, params.id);
  if (denied) return denied;

  const raw = request.nextUrl.searchParams.get('days');
  const days = raw === '7' ? 7 : raw === '90' ? 90 : 30;

  const snap = await adminDb.collection('clients').doc(params.id).get();
  const siteUrl = snap.exists ? (snap.data() as any)?.windsorAccounts?.searchconsole : null;
  if (!siteUrl) {
    return NextResponse.json(
      { error: 'Questo cliente non ha una proprietà Search Console configurata: inseriscila in Setup API.' },
      { status: 503 }
    );
  }

  const from = isoDaysAgo(days);
  const to = isoDaysAgo(0);

  try {
    const [totals, queries, pages, devices, countries] = await Promise.all([
      getSearchConsoleTotals(siteUrl, from, to),
      getSearchConsoleBreakdown(siteUrl, from, to, 'query', 100),
      getSearchConsoleBreakdown(siteUrl, from, to, 'page', 100),
      getSearchConsoleBreakdown(siteUrl, from, to, 'device', 10),
      getSearchConsoleBreakdown(siteUrl, from, to, 'country', 20),
    ]);
    return NextResponse.json({ siteUrl, days, totals, queries, pages, devices, countries });
  } catch (err: any) {
    console.error(`[search-console] fallita per ${params.id}:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
}
