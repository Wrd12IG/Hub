/**
 * GET  /api/clients/[id]/analytics     → GA4 analytics data
 *
 * Restituisce dati REALI da GA4.
 * Se GA4 non è configurato → 503 con notConfigured:true (NO dati finti).
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { getGA4Analytics } from '@/lib/ga4-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;
  const rangeParam = request.nextUrl.searchParams.get('dateRange') || '30d';
  const days = parseInt(rangeParam.replace('d', '')) || 30;

  try {
    const analytics = await getGA4Analytics(clientId, days);
    return NextResponse.json({ ...analytics, _meta: { source: 'live' } });
  } catch (error: any) {
    const isNotConfigured =
      error.message?.includes('non configurato') ||
      error.message?.includes('not configured') ||
      error.message?.includes('GA4') ||
      error.message?.includes('token') ||
      error.message?.includes('credentials');

    return NextResponse.json(
      {
        notConfigured: true,
        error: error.message,
        _meta: {
          source: 'empty',
          hint: 'Vai su ⚙️ Setup API e inserisci il GA4 Property ID e le credenziali Google.',
        },
      },
      { status: 503 }
    );
  }
}
