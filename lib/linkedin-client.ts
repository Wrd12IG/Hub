/**
 * lib/linkedin-client.ts
 *
 * LinkedIn Marketing API + Pages API client.
 *
 * Authentication:
 * - Uses OAuth 2.0 access token stored per client in Firestore.
 * - App registrata su: https://www.linkedin.com/developers/
 * - Scopes richiesti: r_organization_social, r_organization_admin, rw_organization_admin
 *
 * API Version: 202401
 */

import { getClientToken, saveClientToken } from '@/lib/api-auth';

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';
const LINKEDIN_REST_BASE = 'https://api.linkedin.com/rest';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshLinkedInToken(clientId: string, refreshToken: string): Promise<string> {
  const res = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LinkedIn token refresh failed: ${err}`);
  }

  const data = await res.json();
  const newAccessToken = data.access_token;
  const expiresIn = data.expires_in || 5183944; // ~60 giorni default LinkedIn

  await saveClientToken(clientId, 'linkedin', {
    accessToken: newAccessToken,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return newAccessToken;
}

// ─── API Helper ───────────────────────────────────────────────────────────────

async function linkedinFetch<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>,
  baseUrl = LINKEDIN_API_BASE
): Promise<T> {
  const url = new URL(`${baseUrl}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202401',
    },
    next: { revalidate: 900 },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`LinkedIn API ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<T>;
}

// ─── Get Token (with auto-refresh) ───────────────────────────────────────────

export async function getLinkedinToken(clientId: string): Promise<{ accessToken: string; organizationId: string } | null> {
  const tokenData = await getClientToken(clientId, 'linkedin');
  if (!tokenData?.accessToken) return null;

  let accessToken = tokenData.accessToken;

  if (tokenData.expiresAt && Date.now() > tokenData.expiresAt - 60000 && tokenData.refreshToken) {
    try {
      accessToken = await refreshLinkedInToken(clientId, tokenData.refreshToken);
    } catch {
      return null;
    }
  }

  return {
    accessToken,
    organizationId: tokenData.extra?.organizationId || tokenData.accountId || '',
  };
}

// ─── Public API Functions ─────────────────────────────────────────────────────

/**
 * Ottieni statistiche follower dell'organizzazione nel tempo.
 */
export async function getFollowerStats(accessToken: string, orgUrn: string) {
  const data = await linkedinFetch<any>(
    '/organizationalEntityFollowerStatistics',
    accessToken,
    { q: 'organizationalEntity', organizationalEntity: orgUrn }
  );
  return data.elements || [];
}

/**
 * Ottieni statistiche pagina (visite, visualizzazioni, click).
 */
export async function getPageStats(
  accessToken: string,
  orgUrn: string,
  startTs: number,
  endTs: number
) {
  const data = await linkedinFetch<any>(
    '/organizationalEntityPageStatistics',
    accessToken,
    {
      q: 'organization',
      organization: orgUrn,
      'timeIntervals.timeGranularityType': 'DAY',
      'timeIntervals.timeRange.start': String(startTs),
      'timeIntervals.timeRange.end': String(endTs),
    }
  );
  return data.elements || [];
}

/**
 * Ottieni statistiche condivisioni/post dell'organizzazione.
 */
export async function getShareStats(
  accessToken: string,
  orgUrn: string,
  startTs: number,
  endTs: number
) {
  const data = await linkedinFetch<any>(
    '/organizationalEntityShareStatistics',
    accessToken,
    {
      q: 'organizationalEntity',
      organizationalEntity: orgUrn,
      'timeIntervals.timeGranularityType': 'DAY',
      'timeIntervals.timeRange.start': String(startTs),
      'timeIntervals.timeRange.end': String(endTs),
    }
  );
  return data.elements || [];
}

/**
 * Ottieni i post dell'organizzazione.
 */
export async function getOrganizationPosts(accessToken: string, orgUrn: string, count = 20) {
  const data = await linkedinFetch<any>(
    '/posts',
    accessToken,
    {
      author: orgUrn,
      q: 'author',
      count: String(count),
      sortBy: 'LAST_MODIFIED',
    },
    LINKEDIN_REST_BASE
  );
  return data.elements || [];
}

/**
 * Ottieni info base dell'organizzazione (nome, follower count).
 */
export async function getOrganizationInfo(accessToken: string, orgId: string) {
  const data = await linkedinFetch<any>(
    `/organizations/${orgId}`,
    accessToken,
    { fields: 'id,name,logoV2,vanityName' }
  );
  return data;
}

/**
 * Funzione principale: ottieni tutti i dati per la dashboard LinkedIn.
 */
export async function getLinkedinPageData(clientId: string, start?: string, end?: string) {
  const token = await getLinkedinToken(clientId);
  if (!token || !token.organizationId) {
    throw new Error('LinkedIn Integration not configured or Organization URN missing');
  }

  const orgUrn = token.organizationId.includes('urn:li:organization:')
    ? token.organizationId
    : `urn:li:organization:${token.organizationId}`;

  const orgId = orgUrn.replace('urn:li:organization:', '');

  const endDate = end ? new Date(end) : new Date();
  const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const startTs = startDate.getTime();
  const endTs = endDate.getTime();

  const [followerStats, pageStats, shareStats, posts, orgInfo] = await Promise.allSettled([
    getFollowerStats(token.accessToken, orgUrn),
    getPageStats(token.accessToken, orgUrn, startTs, endTs),
    getShareStats(token.accessToken, orgUrn, startTs, endTs),
    getOrganizationPosts(token.accessToken, orgUrn),
    getOrganizationInfo(token.accessToken, orgId),
  ]);

  return {
    organizationId: orgUrn,
    orgInfo: orgInfo.status === 'fulfilled' ? orgInfo.value : null,
    followerStats: followerStats.status === 'fulfilled' ? followerStats.value : [],
    pageStats: pageStats.status === 'fulfilled' ? pageStats.value : [],
    shareStats: shareStats.status === 'fulfilled' ? shareStats.value : [],
    posts: posts.status === 'fulfilled' ? posts.value : [],
  };
}

export interface LinkedinPost {
  id: string;
  title: string;
  tags: string[];
  tipo: string;
  image: string;
  date: string;
  impression: number;
  reazioni: number;
  commenti: number;
  clic: number;
  condivisi: number;
  engagement: number;
  visualizzazioniVideo: number;
  visitatori: number;
}
