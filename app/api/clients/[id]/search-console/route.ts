import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getSearchConsoleTotals, getSearchConsoleBreakdown } from '@/lib/search-console-client';
import { validateRange } from '@/lib/date-range';

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

  const sp = request.nextUrl.searchParams;
  const raw = sp.get('days');
  const days = raw === '7' ? 7 : raw === '90' ? 90 : 30;
  // Intervallo scelto a mano (?from=&to=, stesse regole del report) e versione leggera per la Panoramica:
  // ?compact=1 salta dispositivi e paesi e limita query e pagine alle prime 10.
  const custom = sp.has('from') || sp.has('to') ? validateRange(sp.get('from'), sp.get('to')) : null;
  if (custom && !custom.ok) return NextResponse.json({ error: custom.error }, { status: 400 });
  const compact = sp.get('compact') === '1';

  const snap = await adminDb.collection('clients').doc(params.id).get();
  const siteUrl = snap.exists ? (snap.data() as any)?.windsorAccounts?.searchconsole : null;
  if (!siteUrl) {
    return NextResponse.json(
      { error: 'Questo cliente non ha una proprietà Search Console configurata: inseriscila in Setup API.' },
      { status: 503 }
    );
  }

  const from = custom?.ok ? custom.range.from : isoDaysAgo(days);
  const to = custom?.ok ? custom.range.to : isoDaysAgo(0);

  try {
    const limit = compact ? 10 : 100;
    const [totals, queries, pages, devices, countries] = await Promise.all([
      getSearchConsoleTotals(siteUrl, from, to),
      getSearchConsoleBreakdown(siteUrl, from, to, 'query', limit),
      getSearchConsoleBreakdown(siteUrl, from, to, 'page', limit),
      compact ? Promise.resolve([]) : getSearchConsoleBreakdown(siteUrl, from, to, 'device', 10),
      compact ? Promise.resolve([]) : getSearchConsoleBreakdown(siteUrl, from, to, 'country', 20),
    ]);
    return NextResponse.json({ siteUrl, days, from, to, totals, queries, pages, devices, countries });
  } catch (err: any) {
    console.error(`[search-console] fallita per ${params.id}:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
}
