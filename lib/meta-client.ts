/**
 * lib/meta-client.ts
 * 
 * Meta Graph API v21 client.
 * 
 * Authentication approach:
 * - Uses System User Long-Lived Token (60 days) stored per client in Firestore
 * - See: https://developers.facebook.com/docs/facebook-login/access-tokens/
 * 
 * Meta Ads AI Connector (MCP):
 * - Meta also exposes mcp.facebook.com/ads for AI agent integrations
 * - This client wraps the standard Graph API for server-side use
 */

import { getClientToken } from '@/lib/api-auth';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

export interface MetaCampaign {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  objective: string;
  spend?: number;
  impressions?: number;
  clicks?: number;
  cpc?: number;
  cpa?: number;
  roas?: number;
  reach?: number;
  frequency?: number;
}

export interface MetaInsights {
  spend: string;
  impressions: string;
  clicks: string;
  cpc: string;
  cpm: string;
  ctr: string;
  reach: string;
  frequency: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
  purchase_roas?: { action_type: string; value: string }[];
  date_start: string;
  date_stop: string;
}

export interface MetaAdAccountSummary {
  id: string;
  name: string;
  currency: string;
  account_status: number;
  amount_spent: string;
  balance: string;
  spend_cap: string;
}

// ─── Meta API Helper ──────────────────────────────────────────────────────────

async function metaFetch<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${META_GRAPH_BASE}${path}`);
  url.searchParams.set('access_token', accessToken);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    next: { revalidate: 900 }, // 15 min cache
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Meta API error ${res.status}: ${JSON.stringify(err)}`);
  }

  return res.json() as Promise<T>;
}

// ─── Public API Functions ─────────────────────────────────────────────────────

/**
 * Get the access token for a client's Meta integration.
 * Returns null if the integration is not configured.
 */
export async function getMetaToken(clientId: string): Promise<{accessToken: string, accountId: string, pageId?: string} | null> {
  const tokenData = await getClientToken(clientId, 'meta');
  if (!tokenData) return null;
  return {
    accessToken: tokenData.accessToken,
    accountId: tokenData.accountId || '',
    pageId: tokenData.extra?.pageId,
  };
}

/**
 * Get Meta Ad Account summary (spend, balance, status).
 */
export async function getAdAccountSummary(
  adAccountId: string,
  accessToken: string
): Promise<MetaAdAccountSummary> {
  const cleanId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  return metaFetch<MetaAdAccountSummary>(
    `/${cleanId}`,
    accessToken,
    { fields: 'id,name,currency,account_status,amount_spent,balance,spend_cap' }
  );
}

/**
 * Get all campaigns for an Ad Account with basic insights.
 * Uses time_range for the last 30 days by default.
 */
export async function getCampaigns(
  adAccountId: string,
  accessToken: string,
  datePreset: string = 'last_30d'
): Promise<{ data: MetaCampaign[] }> {
  const cleanId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  return metaFetch<{ data: MetaCampaign[] }>(
    `/${cleanId}/campaigns`,
    accessToken,
    {
      fields: [
        'id',
        'name',
        'status',
        'objective',
        `insights.date_preset(${datePreset}){spend,impressions,clicks,cpc,cpm,ctr,reach,frequency,actions,cost_per_action_type,purchase_roas}`,
      ].join(','),
      limit: '50',
    }
  );
}

/**
 * Get detailed insights for a specific campaign.
 */
export async function getCampaignInsights(
  campaignId: string,
  accessToken: string,
  datePreset: string = 'last_30d'
): Promise<{ data: MetaInsights[] }> {
  return metaFetch<{ data: MetaInsights[] }>(
    `/${campaignId}/insights`,
    accessToken,
    {
      date_preset: datePreset,
      fields: [
        'spend',
        'impressions',
        'clicks',
        'cpc',
        'cpm',
        'ctr',
        'reach',
        'frequency',
        'actions',
        'cost_per_action_type',
        'purchase_roas',
      ].join(','),
    }
  );
}

/**
 * Get Ad Sets for a campaign.
 */
export async function getAdSets(
  campaignId: string,
  accessToken: string,
  datePreset: string = 'last_30d'
): Promise<{ data: object[] }> {
  return metaFetch<{ data: object[] }>(
    `/${campaignId}/adsets`,
    accessToken,
    {
      fields: [
        'id',
        'name',
        'status',
        'targeting',
        'daily_budget',
        `insights.date_preset(${datePreset}){spend,impressions,clicks,cpc,ctr,reach}`,
      ].join(','),
    }
  );
}

/**
 * Get Facebook Page insights (organic posts, reach, engagement).
 */
export async function getPageInsights(
  pageId: string,
  accessToken: string,
  metric: string = 'page_impressions,page_engaged_users',
  period: string = 'day'
): Promise<{ data: any[] }> {
  return metaFetch<{ data: any[] }>(
    `/${pageId}/insights`,
    accessToken,
    { metric, period }
  );
}

/**
 * Get Facebook Page details and latest posts
 */
export async function getFacebookPageData(clientId: string, start?: string, end?: string) {
  const token = await getMetaToken(clientId);
  if (!token || !token.pageId) {
    throw new Error('Meta Integration not configured or Page ID missing');
  }

  // First, get the Page Access Token using the User Access Token
  const pageTokenUrl = `/${token.pageId}`;
  const pageTokenRes = await metaFetch<any>(
    pageTokenUrl,
    token.accessToken,
    { fields: 'access_token' }
  );

  const pageAccessToken = pageTokenRes.access_token;
  if (!pageAccessToken) {
    throw new Error('Could not retrieve Page Access Token. Ensure the user has admin rights on the page.');
  }

  // Get page info and posts using the Page Access Token
  const url = `/${token.pageId}`;
  
  const params: any = { 
    fields: 'name,fan_count,followers_count,posts.limit(20){id,message,created_time,permalink_url,attachments{media_type,media},comments.summary(true),reactions.summary(true),shares}'
  };
  
  if (start) params.since = Math.floor(new Date(start).getTime() / 1000);
  if (end) params.until = Math.floor(new Date(end).getTime() / 1000);

  return metaFetch<any>(url, pageAccessToken, params);
}

/**
 * Get Instagram Business Account details and latest media
 */
export async function getInstagramPageData(clientId: string, start?: string, end?: string) {
  const token = await getMetaToken(clientId);
  if (!token || !token.pageId) {
    throw new Error('Meta Integration not configured or Page ID missing');
  }

  // First, get the Page Access Token and Instagram Business Account ID
  const pageTokenUrl = `/${token.pageId}`;
  const pageTokenRes = await metaFetch<any>(
    pageTokenUrl,
    token.accessToken,
    { fields: 'access_token,instagram_business_account' }
  );

  const pageAccessToken = pageTokenRes.access_token;
  const igAccountId = pageTokenRes.instagram_business_account?.id;

  if (!pageAccessToken || !igAccountId) {
    throw new Error('Could not retrieve Page Access Token or Instagram Business Account not linked.');
  }

  // Get Instagram account info and media using the Page Access Token
  const url = `/${igAccountId}`;
  
  const params: any = { 
    fields: 'username,followers_count,follows_count,media_count,media.limit(20){id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count}'
  };
  
  // Note: Media filtering by date on the connection might require iterating,
  // but we can pass since/until to try filtering the media connection if supported.
  if (start) params.since = Math.floor(new Date(start).getTime() / 1000);
  if (end) params.until = Math.floor(new Date(end).getTime() / 1000);

  return metaFetch<any>(url, pageAccessToken, params);
}

/**
 * Get Instagram Business Account insights.
 */
export async function getInstagramInsights(
  igAccountId: string,
  accessToken: string,
  metric: string = 'impressions,reach,profile_views,follower_count',
  period: string = 'day'
): Promise<{ data: object[] }> {
  return metaFetch<{ data: object[] }>(
    `/${igAccountId}/insights`,
    accessToken,
    { metric, period }
  );
}

// ─── Mock Fallback (dev / token not configured) ───────────────────────────────

export function getMockCampaigns(clientId: string): MetaCampaign[] {
  return [
    {
      id: `meta-${clientId}-001`,
      name: `FB - Conversioni - Lead Gen`,
      status: 'ACTIVE',
      objective: 'LEAD_GENERATION',
      spend: 1250.00,
      cpa: 15.50,
      roas: 4.2,
      impressions: 85000,
      clicks: 1240,
      reach: 62000,
    },
    {
      id: `meta-${clientId}-002`,
      name: `IG - Reels - Awareness`,
      status: 'ACTIVE',
      objective: 'BRAND_AWARENESS',
      spend: 340.50,
      cpa: 5.20,
      roas: 1.5,
      impressions: 240000,
      clicks: 3200,
      reach: 180000,
    },
    {
      id: `meta-${clientId}-003`,
      name: `FB/IG - Retargeting 30gg`,
      status: 'PAUSED',
      objective: 'CONVERSIONS',
      spend: 45.00,
      cpa: 25.00,
      roas: 2.1,
      impressions: 12000,
      clicks: 380,
      reach: 8500,
    },
  ];
}
