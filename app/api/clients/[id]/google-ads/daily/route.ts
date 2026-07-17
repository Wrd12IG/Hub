/**
 * GET /api/clients/[id]/google-ads/daily
 *
 * Restituisce il breakdown giornaliero (ultimi 30 giorni) per le campagne
 * Google Ads di un cliente, aggregati per data.
 *
 * In caso di errore restituisce array vuoto + _meta.source='empty',
 * MAI dati inventati (Math.random / Math.sin rimossi).
 *
 * In ambiente development, se non esistono credenziali reali, ritorna
 * i dati mock deterministici con _meta.source='mock'.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import {
  getGoogleAdsDailyMetrics,
  getMockGoogleAdsDailyMetrics,
  type GoogleAdsDailyMetric,
} from '@/lib/google-ads-client';

interface DailyChartPoint {
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  cpm: number;
  cpc: number;
  ctr: number;
  valoreConversione: number;
  roas: number;
}

/** Aggrega righe per data (ci possono essere più campagne per lo stesso giorno). */
function aggregateByDate(rows: GoogleAdsDailyMetric[]): DailyChartPoint[] {
  const byDate = new Map<string, Omit<DailyChartPoint, 'cpm' | 'cpc' | 'ctr' | 'valoreConversione' | 'roas'>>();

  for (const row of rows) {
    const existing = byDate.get(row.date);
    if (existing) {
      existing.spend += row.spend;
      existing.impressions += row.impressions;
      existing.clicks += row.clicks;
      existing.conversions += row.conversions;
    } else {
      byDate.set(row.date, {
        date: row.date,
        spend: row.spend,
        impressions: row.impressions,
        clicks: row.clicks,
        conversions: row.conversions,
      });
    }
  }

  return Array.from(byDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      const cpm = d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0;
      const cpc = d.clicks > 0 ? d.spend / d.clicks : 0;
      const ctr = d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0;
      // conversions_value non disponibile nel daily GAQL base → usiamo 0
      return {
        date: d.date,
        spend: parseFloat(d.spend.toFixed(2)),
        impressions: d.impressions,
        clicks: d.clicks,
        conversions: d.conversions,
        cpm: parseFloat(cpm.toFixed(2)),
        cpc: parseFloat(cpc.toFixed(2)),
        ctr: parseFloat(ctr.toFixed(2)),
        valoreConversione: 0,
        roas: 0,
      };
    });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;
  if (!clientId) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
  }

  // ── Tentativo con dati reali ──────────────────────────────────────────────
  try {
    const rows = await getGoogleAdsDailyMetrics(clientId);
    const chartData = aggregateByDate(rows);

    return NextResponse.json({
      chartData,
      _meta: { source: 'live', days: chartData.length },
    });
  } catch (liveError: any) {
    console.warn(`[google-ads/daily] Live fetch failed for ${clientId}:`, liveError.message);
  }

  // ── Fallback mock solo in development ────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const mockRows = getMockGoogleAdsDailyMetrics(clientId);
    const chartData = aggregateByDate(mockRows);

    return NextResponse.json({
      chartData,
      _meta: {
        source: 'mock',
        message: 'Google Ads non collegato. Dati simulati deterministici (solo sviluppo).',
      },
    });
  }

  // ── Produzione: dati vuoti, mai inventati ─────────────────────────────────
  return NextResponse.json({
    chartData: [],
    _meta: {
      source: 'empty',
      message: 'Google Ads non collegato. Nessun dato disponibile.',
    },
  });
}
