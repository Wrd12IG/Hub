import { getClientToken } from '@/lib/api-auth';

const LINKEDIN_API_BASE = 'https://api.linkedin.com/v2';

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

// ─── LinkedIn API Helper ──────────────────────────────────────────────────────

async function linkedinFetch<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${LINKEDIN_API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
      'LinkedIn-Version': '202401' // Current API version header
    },
    next: { revalidate: 900 }, // 15 min cache
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`LinkedIn API error ${res.status}: ${JSON.stringify(err)}`);
  }

  return res.json() as Promise<T>;
}

// ─── Public API Functions ─────────────────────────────────────────────────────

export async function getLinkedinToken(clientId: string): Promise<{accessToken: string, organizationId: string} | null> {
  const tokenData = await getClientToken(clientId, 'linkedin');
  if (!tokenData) return null;
  return {
    accessToken: tokenData.accessToken,
    organizationId: tokenData.extra?.organizationId || tokenData.accountId || '',
  };
}

/**
 * Get LinkedIn Organization Page Data
 * Fetches organization follower counts, page statistics, and share (post) statistics.
 */
export async function getLinkedinPageData(clientId: string, start?: string, end?: string) {
  const token = await getLinkedinToken(clientId);
  if (!token || !token.organizationId) {
    throw new Error('LinkedIn Integration not configured or Organization URN missing');
  }

  // To build a robust dashboard, we'd query:
  // 1. /organizationalEntityFollowerStatistics (crescita followers)
  // 2. /organizationalEntityPageStatistics (page views, clicks)
  // 3. /organizationalEntityShareStatistics (post performance)
  // 4. /shares (the actual posts)

  const orgUrn = token.organizationId.includes('urn:li:organization:') 
    ? token.organizationId 
    : `urn:li:organization:${token.organizationId}`;

  // This is a placeholder structure. A real implementation would call these endpoints
  // in parallel and map the responses.
  
  /*
  const [followerStats, pageStats, shareStats] = await Promise.all([
    linkedinFetch<any>(`/organizationalEntityFollowerStatistics?q=organizationalEntity&organizationalEntity=${orgUrn}`, token.accessToken),
    linkedinFetch<any>(`/organizationalEntityPageStatistics?q=organization&organization=${orgUrn}`, token.accessToken),
    linkedinFetch<any>(`/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${orgUrn}`, token.accessToken)
  ]);
  */

  // For now, return a structure that can be integrated or replaced
  return {
    organizationId: orgUrn,
    // Provide an empty structure so the route can safely fallback to mocks if needed
    data: null,
  };
}
