import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { getInstagramPageData } from '@/lib/meta-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const id = params.id;
  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const endDate = endParam ? new Date(endParam) : new Date();
  const startDate = startParam ? new Date(startParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  if (!id) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
  }

  // --- Real Data Fetch ---
  let realData: any = null;
  try {
    realData = await getInstagramPageData(id, startParam || undefined, endParam || undefined);
  } catch (err) {
    console.error('Error fetching real IG data:', err);
  }

  // Gruppa i post reali per data
  const postsByDate: Record<string, number> = {};
  const likesByDate: Record<string, number> = {};
  const commentsByDate: Record<string, number> = {};
  
  let totalPosts = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalReels = 0;

  if (realData?.media?.data) {
    realData.media.data.forEach((m: any) => {
      const d = new Date(m.timestamp).toISOString().split('T')[0];
      postsByDate[d] = (postsByDate[d] || 0) + 1;
      likesByDate[d] = (likesByDate[d] || 0) + (m.like_count || 0);
      commentsByDate[d] = (commentsByDate[d] || 0) + (m.comments_count || 0);
      
      totalPosts++;
      totalLikes += (m.like_count || 0);
      totalComments += (m.comments_count || 0);
      if (m.media_type === 'VIDEO') totalReels++;
    });
  }

  const followersCount = realData?.followers_count || 0;
  const followsCount = realData?.follows_count || 0;
  const mediaCount = realData?.media_count || 0;

  const crescitaSummary = {
    followers: followersCount,
    seguiti: followsCount,
    contenutiTotali: mediaCount
  };

  const crescitaMedie = {
    followers: 0,
    followersGiornalieri: 0,
    followersPerPost: 0,
    seguiti: 0,
    postGiornalieri: totalPosts > 0 ? (totalPosts / diffDays).toFixed(2) : 0,
    postSettimana: totalPosts > 0 ? ((totalPosts / diffDays) * 7).toFixed(1) : 0
  };

  const organicoSummary = {
    engagement: 0,
    interazioni: totalLikes + totalComments,
    coperturaMedia: 0,
    visualizzazioni: 0,
    reels: totalReels
  };

  const interazioniOrganicheSummary = {
    miPiace: totalLikes,
    commenti: totalComments,
    salvati: 0,
    condivisi: 0,
    reels: totalReels
  };

  const organicoMedie = {
    miPiaceGiornalieri: totalLikes > 0 ? (totalLikes / diffDays).toFixed(2) : 0,
    miPiacePerPost: totalLikes > 0 && totalPosts > 0 ? (totalLikes / totalPosts).toFixed(2) : 0,
    commentiGiornalieri: totalComments > 0 ? (totalComments / diffDays).toFixed(2) : 0,
    commentiPerPost: totalComments > 0 && totalPosts > 0 ? (totalComments / totalPosts).toFixed(2) : 0,
    miPiacePerCommento: totalComments > 0 ? (totalLikes / totalComments).toFixed(2) : 0
  };

  const demographics = {
    genere: [],
    eta: [],
    paese: [],
    citta: []
  };

  const generateChartData = (days = diffDays, type: 'crescita' | 'saldo' | 'organico' | 'interazioni'): any[] => {
    return Array.from({ length: days }).map((_, i) => {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateString = date.toISOString().split('T')[0];
      
      if (type === 'crescita') {
        return {
          date: dateString,
          followers: followersCount,
          seguiti: followsCount,
          post: postsByDate[dateString] || 0
        };
      }
      
      if (type === 'saldo') {
        return {
          date: dateString,
          saldo: 0
        };
      }

      if (type === 'organico') {
        return {
          date: dateString,
          copertura: 0,
          visualizzazioni: 0,
          visite: 0,
          post: postsByDate[dateString] || 0
        };
      }

      if (type === 'interazioni') {
        return {
          date: dateString,
          miPiace: likesByDate[dateString] || 0,
          commenti: commentsByDate[dateString] || 0,
          salvati: 0,
          post: postsByDate[dateString] || 0
        };
      }
      
      return { date: dateString };
    });
  };

  const posts = (realData?.media?.data || []).map((m: any) => ({
    id: m.id,
    title: m.caption || 'Senza testo',
    tags: [m.media_type === 'VIDEO' ? 'Reel' : 'Post'],
    image: m.media_url || '/assets/thumb-placeholder.png',
    date: new Date(m.timestamp).toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    copertura: '-',
    impression: '-',
    visualizzazioniVideo: m.media_type === 'VIDEO' ? 0 : 0,
    miPiace: m.like_count || 0,
    commenti: m.comments_count || 0,
    salvati: '-',
    condivisi: '-',
    interazioni: (m.like_count || 0) + (m.comments_count || 0),
    engagement: '-'
  }));

  const reels = posts.filter((p: any) => p.visualizzazioniVideo > 0);

  const hashtags: any[] = [];

  const data = {
    crescitaSummary,
    crescitaMedie,
    crescitaChart: generateChartData(diffDays, 'crescita'),
    saldoFollower: generateChartData(diffDays, 'saldo'),
    demographics,
    organicoSummary,
    interazioniOrganicheSummary,
    organicoMedie,
    organicoChart: generateChartData(diffDays, 'organico'),
    interazioniOrganicheChart: generateChartData(diffDays, 'interazioni'),
    posts,
    reels,
    hashtags
  };

  return NextResponse.json(data);
}
