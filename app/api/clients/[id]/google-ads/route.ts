import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { getGoogleAdsCampaigns, getGoogleAdsDailyMetrics } from '@/lib/google-ads-client';

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

  try {
    // Prova a recuperare i dati reali da Google Ads
    const result = await getGoogleAdsCampaigns(clientId);

    // Mappa le campagne dal formato backend (GoogleAdsCampaign) al formato frontend (Campaign)
    const campaigns = (result.campaigns || []).map((c) => {
      const spend = c.spend || 0;
      const impressions = c.impressions || 0;
      const clicks = c.clicks || 0;
      const conversions = c.conversions || 0;
      const roas = c.roas || 0;
      const valoreConversione = spend * roas;
      
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

      return {
        id: c.id,
        name: c.name,
        updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        impressions,
        clicks,
        conversions,
        cpm,
        cpc,
        ctr,
        valoreConversione,
        roas,
        spend,
      };
    });

    // Calcola il summary coerente
    const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
    const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);
    const totalValoreConversione = campaigns.reduce((sum, c) => sum + c.valoreConversione, 0);

    const summary = {
      spend: totalSpend,
      impressions: totalImpressions,
      clicks: totalClicks,
      conversions: totalConversions,
      cpa: totalConversions > 0 ? totalSpend / totalConversions : 0,
      ctr: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      cpm: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
      cpc: totalClicks > 0 ? totalSpend / totalClicks : 0,
      valoreConversione: totalValoreConversione,
      roas: totalSpend > 0 ? totalValoreConversione / totalSpend : 0,
    };

    // Recupera il breakdown giornaliero reale tramite GAQL
    let chartData: Array<{
      date: string; spend: number; impressions: number; clicks: number;
      conversions: number; cpm: number; cpc: number; ctr: number;
      valoreConversione: number; roas: number;
    }> = [];

    try {
      const dailyRows = await getGoogleAdsDailyMetrics(clientId);

      // Aggrega per data (più campagne nello stesso giorno)
      const byDate = new Map<string, { spend: number; impressions: number; clicks: number; conversions: number }>();
      for (const row of dailyRows) {
        const existing = byDate.get(row.date);
        if (existing) {
          existing.spend += row.spend;
          existing.impressions += row.impressions;
          existing.clicks += row.clicks;
          existing.conversions += row.conversions;
        } else {
          byDate.set(row.date, { spend: row.spend, impressions: row.impressions, clicks: row.clicks, conversions: row.conversions });
        }
      }

      chartData = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, d]) => ({
          date,
          spend: parseFloat(d.spend.toFixed(2)),
          impressions: d.impressions,
          clicks: d.clicks,
          conversions: d.conversions,
          cpm: d.impressions > 0 ? parseFloat(((d.spend / d.impressions) * 1000).toFixed(2)) : 0,
          cpc: d.clicks > 0 ? parseFloat((d.spend / d.clicks).toFixed(2)) : 0,
          ctr: d.impressions > 0 ? parseFloat(((d.clicks / d.impressions) * 100).toFixed(2)) : 0,
          valoreConversione: 0,
          roas: 0,
        }));
    } catch (dailyError: any) {
      // Il chartData rimane [] — mai dati inventati
      console.warn(`[google-ads-api] Daily metrics failed for ${clientId}:`, dailyError.message);
    }

    return NextResponse.json({
      summary,
      chartData,
      campaigns,
      keywords: [],   // Le keyword richiedono una query separata; non vengono simulate
      _meta: {
        source: 'live',
        adAccountId: result.summary.accountId,
        chartDays: chartData.length,
      },
    });
  } catch (error: any) {
    console.error(`[google-ads-api] Error for client ${clientId}:`, error.message);

    const mockSummary = {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      cpa: 0,
      ctr: 0,
      cpm: 0,
      cpc: 0,
      valoreConversione: 0,
      roas: 0,
    };

    return NextResponse.json(
      {
        summary: mockSummary,
        chartData: [],
        campaigns: [],
        keywords: [],
        _meta: {
          source: 'empty',
          message: 'Google Ads non collegato o errore API. Nessun dato disponibile.',
          errorDetail: error.message
        },
      },
      { status: 200 }
    );
  }
}
