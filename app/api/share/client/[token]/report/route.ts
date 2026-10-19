import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getClientMarketingReport, buildWindows } from '@/lib/reporting';
import { buildPublicReport, parsePeriod, type PublicReportComment } from '@/lib/client-report-public';
import { currentMonth, isValidMonth } from '@/lib/monthly-comment';
import { readCachedReport, writeShareReport } from '@/lib/share-report-cache';
import type { Client } from '@/lib/data';

// Come la route dello staff: Google Ads e Meta possono essere lenti alla prima lettura.
export const maxDuration = 60;

// Nessun login: l'unica credenziale è il token del link. Ogni esito negativo (token mancante, sbagliato, revocato)
// risponde allo stesso modo, senza dire cosa non va.
const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });

async function readComment(clientId: string): Promise<PublicReportComment | null> {
  const col = adminDb.collection('clients').doc(clientId).collection('comments');
  const toComment = (id: string, d: any): PublicReportComment | null =>
    isValidMonth(id) && typeof d?.text === 'string' && d.text.trim()
      ? { month: id, text: d.text, updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : d.updatedAt?.toDate?.().toISOString?.() ?? null }
      : null;

  const current = await col.doc(currentMonth()).get();
  if (current.exists) {
    const c = toComment(current.id, current.data());
    if (c) return c;
  }
  // Nessun commento per il mese in corso: il più recente è comunque meglio di niente.
  const recent = await col.orderBy('__name__', 'desc').limit(6).get();
  for (const doc of recent.docs) {
    const c = toComment(doc.id, doc.data());
    if (c) return c;
  }
  return null;
}

export async function GET(request: Request, { params }: { params: { token: string } }) {
  try {
    const token = params.token;
    // I token sono UUID: scartare subito ciò che non lo somiglia evita anche una lettura inutile.
    if (typeof token !== 'string' || token.length < 16 || token.length > 100) return notFound();

    const snap = await adminDb.collection('clients').where('publicToken', '==', token).limit(1).get();
    if (snap.empty) return notFound();
    const doc = snap.docs[0];
    const client = doc.data() as Client & { metaAdAccountId?: string; googleAdAccountId?: string };
    const clientId = doc.id;

    const days = parsePeriod(new URL(request.url).searchParams.get('days'));

    let cached = await readCachedReport(clientId, days);
    if (!cached) {
      // Solo ciò che il cliente vede: spesa Meta e Google Ads, contatti della scheda Google. Il resto (GA4, Klaviyo,
      // Search Console, Instagram…) non serve qui e allungherebbe la lettura.
      const platforms = await getClientMarketingReport(
        {
          metaAdAccountId: client.metaAdAccountId,
          googleAdAccountId: client.googleAdAccountId,
          windsorAccounts: client.windsorAccounts?.gbp ? { gbp: client.windsorAccounts.gbp } : undefined,
        } as any,
        `last_${days}d`,
        buildWindows(days, 'prev_period'),
      );
      cached = { platforms, computedAt: await writeShareReport(clientId, days, platforms) };
    }

    const comment = await readComment(clientId).catch(() => null);

    return NextResponse.json(
      buildPublicReport({ clientName: client.name, days, platforms: cached.platforms, comment, updatedAt: cached.computedAt }),
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err: any) {
    // Il dettaglio resta nei log del server: al visitatore non serve e non deve vederlo.
    console.error('[share-report] errore:', err?.message);
    return NextResponse.json({ error: 'Not available' }, { status: 500 });
  }
}
