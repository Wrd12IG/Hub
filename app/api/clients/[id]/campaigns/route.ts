import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser, ownsClientResource } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getData } from '@/lib/windsor-client';

// Le query a livello campagna su Windsor sono le più lente dell'applicazione
// (~4s a 90 giorni, oltre vanno in timeout): serve un tetto esplicito.
export const maxDuration = 60;


export type CampaignStatus = 'active' | 'paused' | 'ended';

export interface UnifiedCampaign {
  id: string;
  platform: 'meta' | 'google_ads';
  name: string;
  status: CampaignStatus;
  startDate?: string;
  endDate?: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

/** ACTIVE/ENABLED → active, PAUSED → paused, everything else → ended. */
function normalizeStatus(raw: unknown): CampaignStatus {
  const s = String(raw || '').toUpperCase();
  if (s === 'ACTIVE' || s === 'ENABLED') return 'active';
  if (s === 'PAUSED') return 'paused';
  return 'ended';
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}

/** Windsor timestamps come as ISO strings; the UI compares yyyy-MM-dd. */
function toDay(v: unknown): string | undefined {
  const s = typeof v === 'string' ? v.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

const PLATFORMS = {
  meta: {
    connector: 'facebook' as const,
    // campaign_start_time / campaign_stop_time exist on Meta only.
    // Conversions = leads + purchases, not purchases alone: for a car
    // dealership (the pilot client) nobody buys online — measuring only
    // actions_purchase reported 0 conversions for an account actually
    // producing 16 leads on €491 of spend, i.e. it would have called a
    // working account broken. Summing both covers lead-gen and e-commerce.
    fields: ['campaign', 'campaign_id', 'campaign_status', 'campaign_start_time', 'campaign_stop_time',
      'spend', 'clicks', 'impressions', 'actions_lead', 'actions_purchase'],
    conversionsFields: ['actions_lead', 'actions_purchase'],
  },
  google_ads: {
    connector: 'google_ads' as const,
    // Google Ads on Windsor exposes no campaign start/end date. Its
    // `conversions` is already whatever conversion actions the account counts.
    fields: ['campaign', 'campaign_id', 'campaign_status', 'cost', 'clicks', 'impressions', 'conversions'],
    conversionsFields: ['conversions'],
  },
};

/**
 * GET /api/clients/[id]/campaigns
 *
 * Every campaign on the platforms this client has mapped, via Windsor.ai —
 * the same data layer as the rest of the reporting. It replaced a version
 * built on the Hub's own Meta/Google Ads API clients, which needed a
 * per-client OAuth/System-User token that most clients don't have: the tab
 * came up empty for exactly that reason, even for clients with live campaigns.
 *
 * Windsor returns several rows per campaign (per day, per action type), so
 * rows are grouped by campaign id and their metrics summed.
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

  // 90 days is the practical ceiling for campaign-level queries: measured
  // against the real account, last_90d returns in ~4s while last_180d and
  // last_365d both time out at 60s (and Vercel would kill the function first).
  // Widening this needs a different approach — paging, or per-campaign queries
  // — not just a bigger preset. ("maximum" is not a valid Windsor preset at
  // all; the allowed forms are last_Xd/Xw/Xm/Xy, last_year, last_2years,
  // this_month, this_year.)
  const datePreset = request.nextUrl.searchParams.get('date_preset') || 'last_90d';

  const snap = await adminDb.collection('clients').doc(clientId).get();
  if (!snap.exists) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  const client = snap.data() as any;

  const accounts: Partial<Record<keyof typeof PLATFORMS, string>> = {
    meta: client?.metaAdAccountId,
    google_ads: client?.googleAdAccountId,
  };

  const campaigns: UnifiedCampaign[] = [];
  const errors: Record<string, string> = {};

  await Promise.all(
    (Object.keys(PLATFORMS) as (keyof typeof PLATFORMS)[]).map(async (platform) => {
      const accountId = accounts[platform];
      if (!accountId) return;
      const { connector, fields, conversionsFields } = PLATFORMS[platform];
      const sumConversions = (row: Record<string, unknown>) =>
        conversionsFields.reduce((t, f) => t + num(row[f]), 0);

      try {
        const rows = await getData({
          connector,
          accountId,
          fields: [...fields, 'account_id'],
          datePreset,
        });

        // Group by campaign id (falling back to the name when Windsor has no
        // id on a row) and sum the metrics across that campaign's rows.
        const byCampaign = new Map<string, UnifiedCampaign>();
        for (const row of rows) {
          const key = String(row.campaign_id || row.campaign || '');
          if (!key) continue;

          const existing = byCampaign.get(key);
          const spend = num(row.spend) + num(row.cost);
          if (existing) {
            existing.spend += spend;
            existing.clicks += num(row.clicks);
            existing.impressions += num(row.impressions);
            existing.conversions += sumConversions(row);
            existing.startDate = existing.startDate || toDay(row.campaign_start_time);
            existing.endDate = existing.endDate || toDay(row.campaign_stop_time);
          } else {
            byCampaign.set(key, {
              id: key,
              platform,
              name: String(row.campaign || key),
              status: normalizeStatus(row.campaign_status),
              startDate: toDay(row.campaign_start_time),
              endDate: toDay(row.campaign_stop_time),
              spend,
              clicks: num(row.clicks),
              impressions: num(row.impressions),
              conversions: sumConversions(row),
            });
          }
        }
        campaigns.push(...Array.from(byCampaign.values()));
      } catch (err: any) {
        console.error(`[campaigns] ${platform} fetch failed for client ${clientId}:`, err.message);
        errors[platform] = err.message;
      }
    })
  );

  campaigns.sort((a, b) => b.spend - a.spend);
  return NextResponse.json({ campaigns, errors });
}
