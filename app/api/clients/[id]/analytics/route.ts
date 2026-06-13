/**
 * GET  /api/clients/[id]/analytics     → GA4 analytics data
 * POST /api/clients/[id]/analytics     → (future) trigger data refresh
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { getGA4Analytics } from '@/lib/ga4-client';

// ── Mock Fallback (in caso di errore API o senza configurazione) ───────────────
function buildMockAnalytics(clientId: string) {
  const today = new Date();
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    return {
      date: d.toISOString().split('T')[0],
      sessions: 0,
      users: 0,
      pageviews: 0,
    };
  });

  return {
    summary: {
      sessions: 0,
      users: 0,
      newUsers: 0,
      pageviews: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
      conversionRate: 0,
    },
    chartData,
    topPages: [],
    trafficSources: [],
    _meta: { source: 'mock', propertyId: `GA4-mock-${clientId}`, message: 'GA4 Data Unavailable' },
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;
  
  // Prendiamo i giorni dalla query, di default 30
  const rangeParam = request.nextUrl.searchParams.get('dateRange') || '30d';
  const days = parseInt(rangeParam.replace('d', '')) || 30;

  try {
    // ── Esecuzione VERA verso GA4 ──────────────────────────────────
    const analytics = await getGA4Analytics(clientId, days);
    
    return NextResponse.json({
      ...analytics,
      _meta: { source: 'live' }
    });

  } catch (error: any) {
    console.warn(`[analytics] Error for client ${clientId}, serving mock data. Detail:`, error.message);
    
    // In caso di errore (es: credenziali non inserite), facciamo fallback soft
    const mockAnalytics = buildMockAnalytics(clientId);
    return NextResponse.json(mockAnalytics, { status: 200 });
  }
}

