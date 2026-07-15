/**
 * lib/tiktok-client.ts
 *
 * TikTok Business API client (Research API / Content API).
 *
 * Authentication:
 * - Uses OAuth 2.0 access token stored per client in Firestore.
 * - App registrata su: https://developers.tiktok.com/
 * - Scopes richiesti: user.info.basic, video.list, research.adlib.basic
 *
 * Nota: TikTok distingue tra:
 * - Content Creator API (per account personali/creator): video, follower stats
 * - Business API (per account business): post analytics, audience
 */

import { getClientToken, saveClientToken } from '@/lib/api-auth';

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshTikTokToken(clientId: string, refreshToken: string): Promise<string> {
  const res = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY!,
      client_secret: process.env.TIKTOK_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TikTok token refresh failed: ${err}`);
  }

  const data = await res.json();
  if (data.error?.code !== 'ok') {
    throw new Error(`TikTok token refresh error: ${JSON.stringify(data.error)}`);
  }

  const newAccessToken = data.data.access_token;
  const newRefreshToken = data.data.refresh_token;
  const expiresIn = data.data.expires_in || 86400;

  await saveClientToken(clientId, 'tiktok', {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return newAccessToken;
}

// ─── API Helper ───────────────────────────────────────────────────────────────

async function tiktokFetch<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>,
  body?: object
): Promise<T> {
  const url = new URL(`${TIKTOK_API_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const isPost = !!body;
  const res = await fetch(url.toString(), {
    method: isPost ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: isPost ? JSON.stringify(body) : undefined,
    next: { revalidate: 900 },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`TikTok API ${res.status}: ${JSON.stringify(err)}`);
  }

  const json = await res.json() as any;
  if (json.error?.code && json.error.code !== 'ok') {
    throw new Error(`TikTok API error: ${JSON.stringify(json.error)}`);
  }

  return json as T;
}

// ─── Get Token (with auto-refresh) ───────────────────────────────────────────

export async function getTikTokToken(clientId: string): Promise<string | null> {
  const tokenData = await getClientToken(clientId, 'tiktok');
  if (!tokenData?.accessToken) return null;

  if (tokenData.expiresAt && Date.now() > tokenData.expiresAt - 60000 && tokenData.refreshToken) {
    try {
      return await refreshTikTokToken(clientId, tokenData.refreshToken);
    } catch {
      return null;
    }
  }

  return tokenData.accessToken;
}

// ─── Public API Functions ─────────────────────────────────────────────────────

/**
 * Ottieni info utente TikTok (follower count, video count, ecc.).
 */
export async function getTikTokUserInfo(accessToken: string) {
  const data = await tiktokFetch<any>('/user/info/', accessToken, {
    fields: 'open_id,union_id,avatar_url,display_name,bio_description,profile_deep_link,is_verified,follower_count,following_count,likes_count,video_count',
  });
  return data.data?.user || null;
}

/**
 * Ottieni lista video dell'utente con statistiche.
 */
export async function getTikTokVideos(
  accessToken: string,
  cursor?: number,
  maxCount = 20
) {
  const data = await tiktokFetch<any>(
    '/video/list/',
    accessToken,
    { fields: 'id,title,create_time,cover_image_url,share_url,video_description,duration,height,width,title,embed_html,embed_link,like_count,comment_count,share_count,view_count' },
    { max_count: maxCount, cursor: cursor || 0 }
  );

  return {
    videos: data.data?.videos || [],
    cursor: data.data?.cursor,
    hasMore: data.data?.has_more || false,
  };
}

/**
 * Ottieni analytics video (visualizzazioni, like, commenti, condivisioni).
 * Richiede video IDs specifici.
 */
export async function getTikTokVideoAnalytics(accessToken: string, videoIds: string[]) {
  if (!videoIds.length) return [];

  const data = await tiktokFetch<any>(
    '/video/query/',
    accessToken,
    { fields: 'id,create_time,like_count,comment_count,share_count,view_count,play_count,profile_deep_link,title' },
    { filters: { video_ids: videoIds } }
  );

  return data.data?.videos || [];
}

/**
 * Funzione principale: ottieni tutti i dati per la dashboard TikTok.
 */
export async function getTikTokDashboardData(clientId: string) {
  const accessToken = await getTikTokToken(clientId);
  if (!accessToken) {
    throw new Error('TikTok non configurato per questo cliente');
  }

  const [userInfo, videosResult] = await Promise.allSettled([
    getTikTokUserInfo(accessToken),
    getTikTokVideos(accessToken, undefined, 20),
  ]);

  return {
    userInfo: userInfo.status === 'fulfilled' ? userInfo.value : null,
    videos: videosResult.status === 'fulfilled' ? videosResult.value.videos : [],
  };
}
