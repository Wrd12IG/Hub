/**
 * GET /api/clients/[id]/meta/campaigns
 * Lista campagne Meta (view dedicata, separata da /meta-ads)
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, getClientToken } from '@/lib/api-auth';
import { getCampaigns } from '@/lib/meta-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;
  const datePreset = request.nextUrl.searchParams.get('datePreset') || 'last_30d';

  try {
    const tokenData = await getClientToken(clientId, 'meta');

    if (!tokenData?.accessToken || !tokenData?.accountId) {
      return NextResponse.json({
        data: [],
        _meta: { source: 'empty' },
      });
    }

    const result = await getCampaigns(tokenData.accountId, tokenData.accessToken, datePreset);
    return NextResponse.json({ data: result.data, _meta: { source: 'live', datePreset } });
  } catch (error) {
    console.error(`[meta/campaigns] Error for client ${clientId}:`, error);
    return NextResponse.json({ data: [], _meta: { source: 'empty' } });
  }
}
