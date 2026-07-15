import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { getLinkedinPageData } from '@/lib/linkedin-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const { id } = params;
  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const endDate = endParam ? new Date(endParam) : new Date();
  const startDate = startParam ? new Date(startParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  // ─── Real Data ─────────────────────────────────────────────────────────────
  let realData: any = null;
  try {
    realData = await getLinkedinPageData(id, startParam || undefined, endParam || undefined);
  } catch (err: any) {
    console.error('[linkedin/route] Error fetching LinkedIn data:', err.message);
    if (err.message?.includes('not configured') || err.message?.includes('non configurato')) {
      return NextResponse.json({ notConfigured: true, ...buildEmptyResponse(startDate, diffDays) });
    }
  }

  if (!realData) return NextResponse.json(buildEmptyResponse(startDate, diffDays));

  // ─── Map LinkedIn API → Dashboard format ───────────────────────────────────

  // Follower stats: array di {followerGains: {organicFollowerCount, ...}, timeRange: {start, end}}
  const followerElements: any[] = realData.followerStats || [];
  const pageElements: any[] = realData.pageStats || [];
  const shareElements: any[] = realData.shareStats || [];

  // Crescita followers
  const crescitaMap: Record<string, any> = {};
  for (const el of followerElements) {
    const date = el.timeRange?.start
      ? new Date(el.timeRange.start).toISOString().split('T')[0]
      : null;
    if (!date) continue;
    crescitaMap[date] = {
      followers: (el.followerGains?.organicFollowerCount || 0) + (el.followerGains?.paidFollowerCount || 0),
      contenuto: 0,
    };
  }

  // Page stats
  const pageMap: Record<string, any> = {};
  let totalFollowers = 0;
  let totalPageViews = 0;
  let totalUniqueVisitors = 0;
  let totalButtonClicks = 0;

  for (const el of pageElements) {
    const date = el.timeRange?.start
      ? new Date(el.timeRange.start).toISOString().split('T')[0]
      : null;
    if (!date) continue;
    const views = el.totalPageStatistics?.views?.allPageViews?.pageViews || 0;
    const visitors = el.totalPageStatistics?.visitors?.allPageVisits?.uniqueVisitors || 0;
    const clicks = el.totalPageStatistics?.clicks?.clicksByType?.mobileCustomButtonClicksByIndex?.[0]?.clicks || 0;
    pageMap[date] = { views, visitors, clicks };
    totalPageViews += views;
    totalUniqueVisitors += visitors;
    totalButtonClicks += clicks;
  }

  // Share stats
  const shareMap: Record<string, any> = {};
  let totalImpressions = 0;
  let totalEngagements = 0;
  let totalReactions = 0;
  let totalComments = 0;
  let totalClicks = 0;
  let totalShares = 0;
  let totalPosts = 0;

  for (const el of shareElements) {
    const date = el.timeRange?.start
      ? new Date(el.timeRange.start).toISOString().split('T')[0]
      : null;
    if (!date) continue;
    const stats = el.totalShareStatistics || {};
    shareMap[date] = {
      impressions: stats.impressionCount || 0,
      engagements: stats.engagement || 0,
      reactions: stats.likeCount || 0,
      comments: stats.commentCount || 0,
      clicks: stats.clickCount || 0,
      shares: stats.shareCount || 0,
    };
    totalImpressions += stats.impressionCount || 0;
    totalEngagements += stats.engagement || 0;
    totalReactions += stats.likeCount || 0;
    totalComments += stats.commentCount || 0;
    totalClicks += stats.clickCount || 0;
    totalShares += stats.shareCount || 0;
  }

  // Follower count totale dall'ultimo elemento
  if (followerElements.length > 0) {
    const lastEl = followerElements[followerElements.length - 1];
    totalFollowers = (lastEl.followerGains?.organicFollowerCount || 0) + (lastEl.followerGains?.paidFollowerCount || 0);
  }

  // Posts
  const postsRaw = realData.posts || [];
  totalPosts = postsRaw.length;

  const generateChart = (days: number, dataMap: Record<string, any>, fields: object) => {
    return Array.from({ length: days }).map((_, i) => {
      const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const date = d.toISOString().split('T')[0];
      return { date, ...(dataMap[date] || fields) };
    });
  };

  const crescitaChart = generateChart(diffDays, crescitaMap, { followers: 0, contenuto: 0 });
  const riepilogoChart = generateChart(diffDays, shareMap, { engagement: 0, interazioni: 0, impression: 0, post: 0 });
  const interazioniChart = generateChart(diffDays, shareMap, { reazioni: 0, commenti: 0, clic: 0, condivisi: 0, post: 0 });

  const crescitaSummary = {
    followers: totalFollowers,
    mediaVisitatoriUnici: diffDays > 0 ? Math.round(totalUniqueVisitors / diffDays) : 0,
    clicPulsanti: totalButtonClicks,
    visualizzazioniPagina: totalPageViews,
    contenutoTotale: totalPosts,
  };

  const engagement = totalImpressions > 0
    ? Number(((totalEngagements / totalImpressions) * 100).toFixed(2))
    : 0;

  const riepilogoSummary = {
    engagement,
    interazioni: totalEngagements,
    impression: totalImpressions,
    post: totalPosts,
  };

  const interazioniSummary = {
    reazioni: totalReactions,
    commenti: totalComments,
    clic: totalClicks,
    condivisi: totalShares,
    post: totalPosts,
  };

  const averagesSummary = {
    followersGiornalieri: diffDays > 0 ? Math.round(totalFollowers / diffDays) : 0,
    followersPerPost: totalPosts > 0 ? Math.round(totalFollowers / totalPosts) : 0,
    postGiornalieri: diffDays > 0 ? Number((totalPosts / diffDays).toFixed(2)) : 0,
    reazioniGiornaliere: diffDays > 0 ? Math.round(totalReactions / diffDays) : 0,
    reazioniPerContenuto: totalPosts > 0 ? Math.round(totalReactions / totalPosts) : 0,
    commentiGiornalieri: diffDays > 0 ? Math.round(totalComments / diffDays) : 0,
    commentiPerContenuto: totalPosts > 0 ? Math.round(totalComments / totalPosts) : 0,
    clicGiornalieri: diffDays > 0 ? Math.round(totalClicks / diffDays) : 0,
    clicksPerContent: totalPosts > 0 ? Math.round(totalClicks / totalPosts) : 0,
  };

  // Map posts
  const posts = postsRaw.map((p: any) => ({
    id: p.id || '',
    title: p.commentary || p.content?.title || '',
    tags: [],
    tipo: p.content?.media?.mediaType || 'ARTICLE',
    image: p.content?.media?.thumbnails?.[0]?.resolvedUrl || '',
    date: p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('it-IT') : '',
    impression: 0,
    reazioni: 0,
    commenti: 0,
    clic: 0,
    condivisi: 0,
    engagement: 0,
    visualizzazioniVideo: 0,
    visitatori: 0,
  }));

  return NextResponse.json({
    crescitaSummary,
    averagesSummary,
    riepilogoSummary,
    interazioniSummary,
    crescitaChart,
    riepilogoChart,
    interazioniChart,
    posts,
    newsletters: [],
  });
}

function buildEmptyResponse(startDate: Date, diffDays: number) {
  const generateEmptyChart = (days: number, extraFields = {}): any[] =>
    Array.from({ length: days }).map((_, i) => {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      return { date: date.toISOString().split('T')[0], ...extraFields };
    });

  return {
    crescitaSummary: { followers: 0, mediaVisitatoriUnici: 0, clicPulsanti: 0, visualizzazioniPagina: 0, contenutoTotale: 0 },
    averagesSummary: { followersGiornalieri: 0, followersPerPost: 0, postGiornalieri: 0, reazioniGiornaliere: 0, reazioniPerContenuto: 0, commentiGiornalieri: 0, commentiPerContenuto: 0, clicGiornalieri: 0, clicksPerContent: 0 },
    riepilogoSummary: { engagement: 0, interazioni: 0, impression: 0, post: 0 },
    interazioniSummary: { reazioni: 0, commenti: 0, clic: 0, condivisi: 0, post: 0 },
    crescitaChart: generateEmptyChart(diffDays, { followers: 0, contenuto: 0 }),
    riepilogoChart: generateEmptyChart(diffDays, { engagement: 0, interazioni: 0, impression: 0, post: 0 }),
    interazioniChart: generateEmptyChart(diffDays, { reazioni: 0, commenti: 0, clic: 0, condivisi: 0, post: 0 }),
    posts: [],
    newsletters: [],
  };
}
