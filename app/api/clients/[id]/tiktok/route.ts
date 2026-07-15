import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { getTikTokDashboardData } from '@/lib/tiktok-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const { id } = params;

  // ─── Real Data ─────────────────────────────────────────────────────────────
  let rawData: any = null;
  try {
    rawData = await getTikTokDashboardData(id);
  } catch (err: any) {
    console.error('[tiktok/route] Error fetching TikTok data:', err.message);
    if (err.message?.includes('non configurato')) {
      return NextResponse.json({ notConfigured: true, ...buildEmptyResponse() });
    }
  }

  if (!rawData) return NextResponse.json(buildEmptyResponse());

  // ─── Map TikTok API → Dashboard format ────────────────────────────────────
  const userInfo = rawData.userInfo;
  const videos: any[] = rawData.videos || [];

  // Summary aggregato dai video
  const summary = {
    followers: userInfo?.follower_count || 0,
    post: userInfo?.video_count || 0,
    acquisito: 0, // Non disponibile via API pubblica
    perso: 0,
    engagement: 0,
    interazioni: 0,
    coperturaMedia: 0,
    visualizzazioni: 0,
    miPiace: 0,
    commenti: 0,
    condivisi: 0,
    visualizzazioniProfilo: 0,
  };

  // Aggrega dalle statistiche video
  for (const v of videos) {
    summary.visualizzazioni += v.view_count || 0;
    summary.miPiace += v.like_count || 0;
    summary.commenti += v.comment_count || 0;
    summary.condivisi += v.share_count || 0;
    summary.interazioni += (v.like_count || 0) + (v.comment_count || 0) + (v.share_count || 0);
  }

  if (summary.visualizzazioni > 0 && summary.interazioni > 0) {
    summary.engagement = Number(((summary.interazioni / summary.visualizzazioni) * 100).toFixed(2));
  }

  // Build time-series: raggruppa video per data di pubblicazione
  const videosByDate: Record<string, any[]> = {};
  for (const v of videos) {
    const date = v.create_time
      ? new Date(v.create_time * 1000).toISOString().split('T')[0]
      : null;
    if (!date) continue;
    if (!videosByDate[date]) videosByDate[date] = [];
    videosByDate[date].push(v);
  }

  // Genera chart degli ultimi 56 giorni
  const generateChart = (days = 56, extraFn?: (date: string) => object) => {
    return Array.from({ length: days }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const date = d.toISOString().split('T')[0];
      const dayVideos = videosByDate[date] || [];
      const extra = extraFn ? extraFn(date) : {};
      return { date, ...extra };
    });
  };

  const crescitaChart = generateChart(56, (date) => ({
    followers: summary.followers,
    post: videosByDate[date]?.length || 0,
  }));

  const riepilogoChart = generateChart(56, (date) => {
    const dayVideos = videosByDate[date] || [];
    const views = dayVideos.reduce((s, v) => s + (v.view_count || 0), 0);
    const interactions = dayVideos.reduce((s, v) => s + (v.like_count || 0) + (v.comment_count || 0) + (v.share_count || 0), 0);
    return {
      engagement: views > 0 ? Number(((interactions / views) * 100).toFixed(2)) : 0,
      interazioni: interactions,
      coperturaMedia: views,
      visualizzazioni: views,
      post: dayVideos.length,
    };
  });

  const interazioniChart = generateChart(56, (date) => {
    const dayVideos = videosByDate[date] || [];
    return {
      miPiace: dayVideos.reduce((s, v) => s + (v.like_count || 0), 0),
      commenti: dayVideos.reduce((s, v) => s + (v.comment_count || 0), 0),
      condivisi: dayVideos.reduce((s, v) => s + (v.share_count || 0), 0),
      post: dayVideos.length,
    };
  });

  const saldoFollowersChart = generateChart(56, () => ({
    acquisito: 0,
    perso: 0,
    post: 0,
  }));

  const profiloChart = generateChart(56, () => ({
    visualizzazioni: 0,
    post: 0,
  }));

  const postVisualizzatiChart = generateChart(56, (date) => {
    const dayVideos = videosByDate[date] || [];
    return {
      visualizzazioni: dayVideos.reduce((s, v) => s + (v.view_count || 0), 0),
      miPiace: dayVideos.reduce((s, v) => s + (v.like_count || 0), 0),
      commenti: dayVideos.reduce((s, v) => s + (v.comment_count || 0), 0),
      condivisi: dayVideos.reduce((s, v) => s + (v.share_count || 0), 0),
    };
  });

  const medieVisualizzazioniChart = generateChart(56, () => ({
    tempoMedioGuardato: 0,
    durataMediaVideo: 0,
  }));

  // Posts list
  const posts = videos.map((v: any) => ({
    id: v.id,
    title: v.title || v.video_description || '',
    tags: [],
    image: v.cover_image_url || '',
    date: v.create_time
      ? new Date(v.create_time * 1000).toLocaleString('it-IT')
      : '',
    visualizzazioni: v.view_count || 0,
    tempoVisualizzazione: '-',
    durataMedia: v.duration ? `${Math.floor(v.duration / 60)}:${String(v.duration % 60).padStart(2, '0')}` : '-',
    miPiace: v.like_count || 0,
    nonMiPiace: 0,
    commenti: v.comment_count || 0,
    condivisi: v.share_count || 0,
  }));

  return NextResponse.json({
    summary,
    crescitaChart,
    saldoFollowersChart,
    riepilogoChart,
    interazioniChart,
    profiloChart,
    postVisualizzatiChart,
    medieVisualizzazioniChart,
    posts,
  });
}

function buildEmptyResponse() {
  const generateEmptyChart = (days = 56, extraFields = {}) =>
    Array.from({ length: days }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      return { date: date.toISOString().split('T')[0], ...extraFields };
    });

  return {
    summary: {
      followers: 0, post: 0, acquisito: 0, perso: 0, engagement: 0,
      interazioni: 0, coperturaMedia: 0, visualizzazioni: 0,
      miPiace: 0, commenti: 0, condivisi: 0, visualizzazioniProfilo: 0,
    },
    crescitaChart: generateEmptyChart(56, { followers: 0, post: 0 }),
    saldoFollowersChart: generateEmptyChart(56, { acquisito: 0, perso: 0, post: 0 }),
    riepilogoChart: generateEmptyChart(56, { engagement: 0, interazioni: 0, coperturaMedia: 0, visualizzazioni: 0, post: 0 }),
    interazioniChart: generateEmptyChart(56, { miPiace: 0, commenti: 0, condivisi: 0, post: 0 }),
    profiloChart: generateEmptyChart(56, { visualizzazioni: 0, post: 0 }),
    postVisualizzatiChart: generateEmptyChart(56, { visualizzazioni: 0, miPiace: 0, commenti: 0, condivisi: 0 }),
    medieVisualizzazioniChart: generateEmptyChart(56, { tempoMedioGuardato: 0, durataMediaVideo: 0 }),
    posts: [],
  };
}
