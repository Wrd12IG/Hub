/**
 * lib/youtube-client.ts
 *
 * YouTube Data API v3 + YouTube Analytics API client.
 *
 * Authentication:
 * - Uses OAuth 2.0 access token (+ refresh token) stored per client in Firestore.
 * - Requires scopes: youtube.readonly, yt-analytics.readonly
 *
 * Google Cloud Console setup:
 * - Enable "YouTube Data API v3" and "YouTube Analytics API"
 * - Create OAuth 2.0 credentials → same Google Cloud project as Firebase
 */

import { getClientToken, saveClientToken } from '@/lib/api-auth';

const YT_DATA_BASE = 'https://www.googleapis.com/youtube/v3';
const YT_ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// ─── Token refresh ────────────────────────────────────────────────────────────

async function refreshYouTubeToken(clientId: string, refreshToken: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube token refresh failed: ${err}`);
  }

  const data = await res.json();
  const newAccessToken = data.access_token;
  const expiresIn = data.expires_in || 3600;

  // Aggiorna il token salvato in Firestore
  await saveClientToken(clientId, 'youtube', {
    accessToken: newAccessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return newAccessToken;
}

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function ytDataFetch<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${YT_DATA_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 900 },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`YouTube Data API ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<T>;
}

async function ytAnalyticsFetch<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${YT_ANALYTICS_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 900 },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`YouTube Analytics API ${res.status}: ${JSON.stringify(err)}`);
  }
  return res.json() as Promise<T>;
}

// ─── Get Token (with auto-refresh) ───────────────────────────────────────────

export async function getYouTubeToken(clientId: string): Promise<string | null> {
  const tokenData = await getClientToken(clientId, 'youtube');
  if (!tokenData?.accessToken) return null;

  // Se il token è scaduto e abbiamo il refresh token, rinnoviamo
  if (tokenData.expiresAt && Date.now() > tokenData.expiresAt - 60000 && tokenData.refreshToken) {
    try {
      return await refreshYouTubeToken(clientId, tokenData.refreshToken);
    } catch {
      return null;
    }
  }

  return tokenData.accessToken;
}

// ─── Public API Functions ─────────────────────────────────────────────────────

/**
 * Ottieni il canale YouTube del cliente (id, statistiche globali).
 */
export async function getChannelStats(accessToken: string) {
  const data = await ytDataFetch<any>('/channels', accessToken, {
    part: 'snippet,statistics',
    mine: 'true',
  });
  return data.items?.[0] || null;
}

/**
 * Ottieni lista video del canale con statistiche base.
 */
export async function getChannelVideos(accessToken: string, channelId: string, maxResults = 20) {
  // Prima otteniamo il playlist delle upload
  const channelData = await ytDataFetch<any>('/channels', accessToken, {
    part: 'contentDetails',
    id: channelId,
  });

  const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) return [];

  // Poi otteniamo i video dal playlist
  const playlistItems = await ytDataFetch<any>('/playlistItems', accessToken, {
    part: 'snippet,contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: String(maxResults),
  });

  const videoIds = playlistItems.items?.map((i: any) => i.contentDetails.videoId).join(',');
  if (!videoIds) return [];

  // Infine otteniamo le statistiche dei video
  const videoStats = await ytDataFetch<any>('/videos', accessToken, {
    part: 'snippet,statistics,contentDetails',
    id: videoIds,
  });

  return videoStats.items || [];
}

/**
 * Ottieni analytics del canale: visualizzazioni, iscritti, tempo di visione.
 */
export async function getChannelAnalytics(
  accessToken: string,
  channelId: string,
  startDate: string,
  endDate: string
) {
  const data = await ytAnalyticsFetch<any>('/reports', accessToken, {
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: 'views,estimatedMinutesWatched,averageViewDuration,likes,dislikes,comments,shares,subscribersGained,subscribersLost',
    dimensions: 'day',
    sort: 'day',
  });
  return data;
}

/**
 * Ottieni analytics demografiche del canale.
 */
export async function getChannelDemographics(
  accessToken: string,
  channelId: string,
  startDate: string,
  endDate: string
) {
  const [gender, age, country, traffic] = await Promise.allSettled([
    ytAnalyticsFetch<any>('/reports', accessToken, {
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: 'viewerPercentage',
      dimensions: 'gender',
    }),
    ytAnalyticsFetch<any>('/reports', accessToken, {
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: 'viewerPercentage',
      dimensions: 'ageGroup',
    }),
    ytAnalyticsFetch<any>('/reports', accessToken, {
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: 'views',
      dimensions: 'country',
      sort: '-views',
      maxResults: '10',
    }),
    ytAnalyticsFetch<any>('/reports', accessToken, {
      ids: `channel==${channelId}`,
      startDate,
      endDate,
      metrics: 'views',
      dimensions: 'insightTrafficSourceType',
      sort: '-views',
    }),
  ]);

  return {
    gender: gender.status === 'fulfilled' ? gender.value : null,
    age: age.status === 'fulfilled' ? age.value : null,
    country: country.status === 'fulfilled' ? country.value : null,
    traffic: traffic.status === 'fulfilled' ? traffic.value : null,
  };
}

/**
 * Funzione principale: ottieni tutti i dati per la dashboard YouTube.
 */
export async function getYouTubeDashboardData(clientId: string, startDate: string, endDate: string) {
  const accessToken = await getYouTubeToken(clientId);
  if (!accessToken) {
    throw new Error('YouTube non configurato per questo cliente');
  }

  const channel = await getChannelStats(accessToken);
  if (!channel) {
    throw new Error('Nessun canale YouTube trovato');
  }

  const channelId = channel.id;

  const [analytics, videos, demographics] = await Promise.allSettled([
    getChannelAnalytics(accessToken, channelId, startDate, endDate),
    getChannelVideos(accessToken, channelId, 20),
    getChannelDemographics(accessToken, channelId, startDate, endDate),
  ]);

  return {
    channel,
    analytics: analytics.status === 'fulfilled' ? analytics.value : null,
    videos: videos.status === 'fulfilled' ? videos.value : [],
    demographics: demographics.status === 'fulfilled' ? demographics.value : null,
  };
}
