import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { getFacebookPageData } from '@/lib/meta-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  const endDate = endParam ? new Date(endParam) : new Date();
  const startDate = startParam ? new Date(startParam) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  let realData: any = null;
  
  let errMessage = null;
  try {
    realData = await getFacebookPageData(params.id, startParam || undefined, endParam || undefined);
  } catch (err: any) {
    console.error('Error fetching real FB data:', err);
    errMessage = err.message;
  }

  // Gruppa i post reali per data
  const postsByDate: Record<string, number> = {};
  let totalPosts = 0;
  if (realData?.posts?.data) {
    realData.posts.data.forEach((p: any) => {
      const d = new Date(p.created_time).toISOString().split('T')[0];
      postsByDate[d] = (postsByDate[d] || 0) + 1;
      totalPosts++;
    });
  }

  const followersCount = realData?.followers_count || 0;
  
  // Real stats parsing if available, else 0
  const realViews = realData?.page_views || 0;
  const realVisits = realData?.page_visits || 0;
  const realAcquired = realData?.new_followers || 0;
  const realLost = realData?.lost_followers || 0;
  const realClicks = realData?.clicks || 0;
  const realReach = realData?.reach || 0;

  // Calcola metriche reali dai post
  let totalReactions = 0;
  let totalComments = 0;
  let totalShares = 0;

  if (realData?.posts?.data) {
    realData.posts.data.forEach((p: any) => {
      totalReactions += p.reactions?.summary?.total_count || 0;
      totalComments += p.comments?.summary?.total_count || 0;
      totalShares += p.shares?.count || 0;
    });
  }
  const realEngagement = totalReactions + totalComments + totalShares;

  const data = {
    crescitaSummary: {
      followers: followersCount,
      visualizzazioni: realViews.toLocaleString('it-IT'),
      visitePagina: realVisits.toLocaleString('it-IT'),
      contenutiTotali: totalPosts
    },
    crescitaMedie: {
      followersGiornalieri: 0,
      visiteGiornaliere: 0,
      postGiornalieri: diffDays > 0 ? (totalPosts / diffDays).toFixed(2) : 0,
      postSettimana: diffDays > 0 ? ((totalPosts / diffDays) * 7).toFixed(1) : 0
    },
    crescitaChart: Array.from({ length: diffDays }).map((_, i) => {
      const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      return {
        date: d.toISOString(),
        followers: followersCount,
        contenuti: postsByDate[dateStr] || 0
      };
    }),
    saldoFollowerSummary: {
      acquisiti: realAcquired,
      persi: realLost,
      contenutiTotali: totalPosts
    },
    saldoFollower: Array.from({ length: diffDays }).map((_, i) => ({
      date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      acquisiti: 0,
      persi: 0,
    })),
    postVisualizzatiSummary: {
      visualizzazioni: realViews.toLocaleString('it-IT'),
      reazioni: totalReactions.toLocaleString('it-IT')
    },
    postVisualizzatiChart: Array.from({ length: diffDays }).map((_, i) => ({
      date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      visualizzazioni: 0,
      reazioni: 0
    })),

    // 2. Dati Demografici (Real or Empty)
    demographics: {
      genere: realData?.demographics?.genere || [],
      eta: realData?.demographics?.eta || [],
      paese: realData?.demographics?.paese || [],
      citta: realData?.demographics?.citta || [],
    },

    // 3. Clic
    clicSummary: {
      clicTotali: realClicks,
      visitePagina: realVisits.toLocaleString('it-IT'),
      contenutiTotali: totalPosts
    },
    clicChart: Array.from({ length: diffDays }).map((_, i) => ({
      date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      clic: 0,
      visite: 0,
      contenuti: postsByDate[new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]] || 0
    })),

    // 4. Post Pubblicati (Organico)
    organicoSummary: {
      engagement: realEngagement,
      interazioni: realEngagement,
      coperturaMedia: 0,
      visualizzazioni: '-', // Richiede permessi insights aggiuntivi
      post: totalPosts
    },
    organicoChart: Array.from({ length: diffDays }).map((_, i) => ({
      date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      engagement: 0,
      interazioni: 0,
      copertura: 0,
      visualizzazioni: 0,
      post: postsByDate[new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]] || 0
    })),
    interazioniOrganicheSummary: {
      reazioni: totalReactions,
      commenti: totalComments,
      condivisi: totalShares,
      clic: 0,
      post: totalPosts
    },
    interazioniOrganicheChart: Array.from({ length: diffDays }).map((_, i) => ({
      date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      reazioni: 0,
      commenti: 0,
      condivisi: 0,
      clic: 0,
      post: postsByDate[new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0]] || 0
    })),
    organicoMedie: {
      reazioniGiornaliere: 0,
      reazioniPerPost: 0,
      commentiGiornalieri: 0,
      commentiPerPost: 0,
      condivisioniGiornaliere: 0,
      condivisioniPerPost: 0
    },
    tipiVisualizzazioni: {
      tipi: [],
      visualizzazioni: []
    },

    // 5. Reels
    reelsSummary: {
      engagement: 0,
      interazioni: 0,
      coperturaMedia: 0,
      visualizzazioniVideo: '0',
      reels: 0
    },
    reelsChart: Array.from({ length: diffDays }).map((_, i) => ({
      date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      engagement: 0,
      interazioni: 0,
      copertura: 0,
      visualizzazioni: 0,
      reels: 0
    })),
    reelsInterazioniSummary: {
      miPiace: 0,
      azioni: 0,
      reels: 0
    },
    reelsInterazioniChart: Array.from({ length: diffDays }).map((_, i) => ({
      date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      miPiace: 0,
      azioni: 0,
      reels: 0
    })),

    // 6. Storie
    storieSummary: {
      storie: 0
    },
    storieChart: Array.from({ length: diffDays }).map((_, i) => ({
      date: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
      storie: 0
    })),

    // 7. Tabelle (Posts, Reels, Storie)
    posts: [],
    reels: [],
    storieList: []
  };

  // Se abbiamo i post reali, formattiamoli e sostituiamo quelli fittizi
  if (realData && realData.posts && realData.posts.data) {
    data.posts = realData.posts.data.map((p: any) => {
      const reactions = p.reactions?.summary?.total_count || 0;
      const comments = p.comments?.summary?.total_count || 0;
      const shares = p.shares?.count || 0;
      const engagement = reactions + comments + shares;

      return {
        id: p.id,
        title: p.message || 'Senza testo',
        tags: p.attachments?.data?.[0]?.media_type === 'video' ? ['Video'] : ['Immagine'],
        image: p.attachments?.data?.[0]?.media?.image?.src || null,
        date: p.created_time,
        copertura: 0, // Necessita permessi avanzati
        visualizzazioni: 0, // Necessita permessi avanzati
        reazioni: reactions,
        commenti: comments,
        condivisi: shares,
        clic: 0,
        clicLink: 0,
        visVideo: 0,
        tempoVideo: '0:00',
        engagement: engagement,
        spesa: '0'
      };
    });
  }

  return NextResponse.json({ ...data, debug_error: errMessage });
}
