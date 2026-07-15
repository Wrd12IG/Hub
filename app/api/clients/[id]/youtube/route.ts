import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { getYouTubeDashboardData } from '@/lib/youtube-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const { id } = params;
  const { searchParams } = new URL(request.url);

  const endDate = searchParams.get('end') || new Date().toISOString().split('T')[0];
  const startDate = searchParams.get('start') ||
    new Date(Date.now() - 56 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // ─── Real Data ─────────────────────────────────────────────────────────────
  let rawData: any = null;
  try {
    rawData = await getYouTubeDashboardData(id, startDate, endDate);
  } catch (err: any) {
    console.error('[youtube/route] Error fetching YouTube data:', err.message);
    // Se non configurato, restituiamo struttura vuota con flag
    if (err.message?.includes('non configurato')) {
      return NextResponse.json({ notConfigured: true, ...buildEmptyResponse(startDate, endDate) });
    }
  }

  if (!rawData) return NextResponse.json(buildEmptyResponse(startDate, endDate));

  // ─── Map YouTube Analytics → Dashboard format ──────────────────────────────
  const channel = rawData.channel;
  const analyticsRows: any[] = rawData.analytics?.rows || [];
  const columnHeaders: string[] = rawData.analytics?.columnHeaders?.map((h: any) => h.name) || [];

  // Helper per trovare indice colonna
  const col = (name: string) => columnHeaders.indexOf(name);

  // Aggregate totals
  const summary = {
    visualizzazioni: 0,
    miPiace: 0,
    nonMiPiace: 0,
    commenti: 0,
    condivisi: 0,
    iscrittiGuadagnati: 0,
    iscrittiPersi: 0,
    iscrittiVideo: 0,
    subscriberCount: Number(channel?.statistics?.subscriberCount || 0),
    videoCount: Number(channel?.statistics?.videoCount || 0),
    minutiGuardati: 0,
  };

  // Build time-series charts
  const interactionChart: any[] = [];
  const subscriberChart: any[] = [];

  for (const row of analyticsRows) {
    const date = row[col('day')] || row[0];
    const views = Number(row[col('views')] || 0);
    const minutes = Number(row[col('estimatedMinutesWatched')] || 0);
    const likes = Number(row[col('likes')] || 0);
    const dislikes = Number(row[col('dislikes')] || 0);
    const comments = Number(row[col('comments')] || 0);
    const shares = Number(row[col('shares')] || 0);
    const subsGained = Number(row[col('subscribersGained')] || 0);
    const subsLost = Number(row[col('subscribersLost')] || 0);

    summary.visualizzazioni += views;
    summary.miPiace += likes;
    summary.nonMiPiace += dislikes;
    summary.commenti += comments;
    summary.condivisi += shares;
    summary.iscrittiGuadagnati += subsGained;
    summary.iscrittiPersi += subsLost;
    summary.minutiGuardati += minutes;

    interactionChart.push({
      date,
      visualizzazioni: views,
      miPiace: likes,
      nonMiPiace: dislikes,
      commenti: comments,
      condiviso: shares,
    });

    subscriberChart.push({
      date,
      guadagnato: subsGained,
      perso: subsLost,
      video: 0,
    });
  }

  // Demographics
  const dem = rawData.demographics || {};
  const mapDemRows = (d: any) => d?.rows?.map((r: any) => ({
    label: r[0],
    value: r[1],
  })) || [];

  const demographics = {
    genere: mapDemRows(dem.gender),
    eta: mapDemRows(dem.age),
    paese: mapDemRows(dem.country),
    traffico: mapDemRows(dem.traffic),
  };

  // Videos list
  const videos = (rawData.videos || []).map((v: any) => ({
    id: v.id,
    title: v.snippet?.title || '',
    date: v.snippet?.publishedAt?.split('T')[0] || '',
    thumbnail: v.snippet?.thumbnails?.medium?.url || '',
    url: `https://youtube.com/watch?v=${v.id}`,
    visualizzazioni: Number(v.statistics?.viewCount || 0),
    miPiace: Number(v.statistics?.likeCount || 0),
    nonMiPiace: Number(v.statistics?.dislikeCount || 0),
    commenti: Number(v.statistics?.commentCount || 0),
    condivisi: 0, // non disponibile via Data API
    durataMedia: v.contentDetails?.duration || '',
  }));

  return NextResponse.json({
    summary,
    interactionChart,
    subscriberChart,
    videos,
    demographics,
  });
}

function buildEmptyResponse(startDate: string, endDate: string) {
  const days = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) || 56;

  const emptyChart = (fields: object) =>
    Array.from({ length: days }).map((_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      return { date: d.toISOString().split('T')[0], ...fields };
    });

  return {
    summary: {
      visualizzazioni: 0, miPiace: 0, nonMiPiace: 0, commenti: 0,
      condivisi: 0, iscrittiGuadagnati: 0, iscrittiPersi: 0,
      iscrittiVideo: 0, subscriberCount: 0, videoCount: 0, minutiGuardati: 0,
    },
    interactionChart: emptyChart({ visualizzazioni: 0, miPiace: 0, nonMiPiace: 0, commenti: 0, condiviso: 0 }),
    subscriberChart: emptyChart({ guadagnato: 0, perso: 0, video: 0 }),
    videos: [],
    demographics: { genere: [], eta: [], paese: [], traffico: [] },
  };
}
