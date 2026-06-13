/**
 * GET /api/clients/[id]/meta/campaigns/[cid]/insights
 * Insight dettagliati per una singola campagna Meta
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, getClientToken } from '@/lib/api-auth';
import { getCampaignInsights } from '@/lib/meta-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; cid: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId, cid: campaignId } = params;
  const datePreset = request.nextUrl.searchParams.get('datePreset') || 'last_30d';

  try {
    const tokenData = await getClientToken(clientId, 'meta');

    if (!tokenData?.accessToken) {
      return NextResponse.json({
        data: [],
        _meta: { source: 'empty', message: 'Meta not connected' },
      });
    }

    const result = await getCampaignInsights(campaignId, tokenData.accessToken, datePreset);
    return NextResponse.json({ data: result.data, _meta: { source: 'live', campaignId, datePreset } });
  } catch (error) {
    console.error(`[meta/campaigns/insights] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign insights', details: String(error) },
      { status: 500 }
    );
  }
}
