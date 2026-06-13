import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, getClientToken } from '@/lib/api-auth';
import { getCampaigns, getAdAccountSummary } from '@/lib/meta-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;
  if (!clientId) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
  }

  const datePreset = request.nextUrl.searchParams.get('datePreset') || 'last_30d';

  try {
    // ── Get token from Firestore ─────────────────────────────────────────────
    const tokenData = await getClientToken(clientId, 'meta');

    if (!tokenData?.accessToken || !tokenData?.accountId) {
      console.log(`[meta-ads] No Meta token for client ${clientId}, returning zero data`);
      return NextResponse.json({
        campaigns: [],
        account: null,
        _meta: {
          source: 'empty',
          message: 'Meta Ads not connected. Configure integration in Settings.',
        },
      });
    }

    // ── Real Meta Graph API call ─────────────────────────────────────────────
    const [campaignsData, accountSummary] = await Promise.all([
      getCampaigns(tokenData.accountId, tokenData.accessToken, datePreset),
      getAdAccountSummary(tokenData.accountId, tokenData.accessToken),
    ]);

    // Normalize campaign insights into a flat structure
    const campaigns = campaignsData.data.map((c: any) => {
      const insights = c.insights?.data?.[0] || {};
      const roas = insights.purchase_roas?.[0]?.value
        ? parseFloat(insights.purchase_roas[0].value)
        : null;

      return {
        id: c.id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        spend: parseFloat(insights.spend || '0'),
        impressions: parseInt(insights.impressions || '0'),
        clicks: parseInt(insights.clicks || '0'),
        cpc: parseFloat(insights.cpc || '0'),
        cpm: parseFloat(insights.cpm || '0'),
        ctr: parseFloat(insights.ctr || '0'),
        reach: parseInt(insights.reach || '0'),
        frequency: parseFloat(insights.frequency || '0'),
        roas,
        dateStart: insights.date_start,
        dateStop: insights.date_stop,
      };
    });

    return NextResponse.json({
      campaigns,
      account: accountSummary,
      _meta: {
        source: 'live',
        adAccountId: tokenData.accountId,
        datePreset,
      },
    });
  } catch (error) {
    console.error(`[meta-ads] Error for client ${clientId}:`, error);

    // Graceful degradation: return empty on API error
    return NextResponse.json(
      {
        campaigns: [],
        account: null,
        _meta: {
          source: 'empty',
          error: 'Meta API temporarily unavailable or not connected',
        },
      },
      { status: 200 }
    );
  }
}
