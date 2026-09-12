import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser, ownsClientResource, getClientToken } from '@/lib/api-auth';
import { getCampaigns as getMetaCampaigns } from '@/lib/meta-client';
import { getGoogleAdsCampaigns } from '@/lib/google-ads-client';

export type CampaignStatus = 'active' | 'paused' | 'ended';

export interface UnifiedCampaign {
  id: string;
  platform: 'meta' | 'google_ads';
  name: string;
  status: CampaignStatus;
  objective?: string; // Meta only — feeds the existing "Report KPI" modal
  startDate?: string;
  endDate?: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

function normalizeMetaStatus(status: string): CampaignStatus {
  if (status === 'ACTIVE') return 'active';
  if (status === 'PAUSED') return 'paused';
  return 'ended'; // DELETED / ARCHIVED
}

function normalizeGoogleStatus(status: string): CampaignStatus {
  if (status === 'ENABLED') return 'active';
  if (status === 'PAUSED') return 'paused';
  return 'ended'; // REMOVED / UNKNOWN
}

/**
 * GET /api/clients/[id]/campaigns
 *
 * Real campaign list across every ad platform this client has connected
 * (Meta Ads, Google Ads today — same platforms already wired for reporting).
 * Feeds the "Campagne" tab (filterable by date/status client-side).
 * A platform that isn't connected, or whose fetch fails, is simply omitted —
 * this endpoint never errors out just because one platform has no token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();

  const clientId = params.id;
  const user = await getAppUser(auth.uid);
  if (!isStaffUser(user) && !ownsClientResource(user, clientId)) return forbiddenResponse();

  const campaigns: UnifiedCampaign[] = [];
  const errors: Record<string, string> = {};

  const [metaToken, googleToken] = await Promise.all([
    getClientToken(clientId, 'meta'),
    getClientToken(clientId, 'google'),
  ]);

  await Promise.all([
    (async () => {
      if (!metaToken?.accessToken || !metaToken?.accountId) return;
      try {
        // 'maximum' pulls the account's full available history so ended/paused
        // campaigns from any time still show up — the tab filters afterwards.
        const result = await getMetaCampaigns(metaToken.accountId, metaToken.accessToken, 'maximum');
        for (const c of result.data as any[]) {
          const insights = c.insights?.data?.[0] || {};
          campaigns.push({
            id: c.id,
            platform: 'meta',
            name: c.name,
            status: normalizeMetaStatus(c.status),
            objective: c.objective,
            startDate: insights.date_start,
            endDate: insights.date_stop,
            spend: parseFloat(insights.spend || '0'),
            impressions: parseInt(insights.impressions || '0', 10),
            clicks: parseInt(insights.clicks || '0', 10),
            conversions: insights.actions?.reduce((sum: number, a: any) => sum + (parseInt(a.value, 10) || 0), 0) || 0,
          });
        }
      } catch (err: any) {
        console.error(`[campaigns] Meta fetch failed for client ${clientId}:`, err.message);
        errors.meta = err.message;
      }
    })(),
    (async () => {
      if (!googleToken?.refreshToken || !googleToken?.accountId) return;
      try {
        const result = await getGoogleAdsCampaigns(clientId);
        for (const c of result.campaigns) {
          campaigns.push({
            id: c.id,
            platform: 'google_ads',
            name: c.name,
            status: normalizeGoogleStatus(c.status),
            startDate: c.startDate,
            endDate: c.endDate,
            spend: c.spend,
            impressions: c.impressions,
            clicks: c.clicks,
            conversions: c.conversions,
          });
        }
      } catch (err: any) {
        console.error(`[campaigns] Google Ads fetch failed for client ${clientId}:`, err.message);
        errors.google_ads = err.message;
      }
    })(),
  ]);

  return NextResponse.json({ campaigns, errors });
}
