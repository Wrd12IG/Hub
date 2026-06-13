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

  if (!id) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
  }

  // --- Real Data Fetch ---
  let realData: any = null;
  try {
    realData = await getLinkedinPageData(id, startParam || undefined, endParam || undefined);
  } catch (err) {
    console.error('Error fetching real LinkedIn data:', err);
  }

  // For now, if realData is available we could parse it here
  // Since it's a skeleton, it will fallback safely.

  const posts: any[] = [];
  const newsletters: any[] = [];

  const crescitaSummary = {
    followers: 0,
    mediaVisitatoriUnici: 0,
    clicPulsanti: 0,
    visualizzazioniPagina: 0,
    contenutoTotale: 0
  };

  const averagesSummary = {
    followersGiornalieri: 0,
    followersPerPost: 0,
    postGiornalieri: 0,
    reazioniGiornaliere: 0,
    reazioniPerContenuto: 0,
    commentiGiornalieri: 0,
    commentiPerContenuto: 0,
    clicGiornalieri: 0,
    clicksPerContent: 0
  };

  const riepilogoSummary = {
    engagement: 0,
    interazioni: 0,
    impression: 0,
    post: 0
  };

  const interazioniSummary = {
    reazioni: 0,
    commenti: 0,
    clic: 0,
    condivisi: 0,
    post: 0
  };

  const generateEmptyChart = (days = diffDays, extraFields = {}): any[] => {
    return Array.from({ length: days }).map((_, i) => {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      return {
        date: date.toISOString().split('T')[0],
        ...extraFields
      };
    });
  };

  const crescitaChart = generateEmptyChart(diffDays, { followers: 0, contenuto: 0 });
  const riepilogoChart = generateEmptyChart(diffDays, { engagement: 0, interazioni: 0, impression: 0, post: 0 });
  const interazioniChart = generateEmptyChart(diffDays, { reazioni: 0, commenti: 0, clic: 0, condivisi: 0, post: 0 });

  return NextResponse.json({
    crescitaSummary,
    averagesSummary,
    riepilogoSummary,
    interazioniSummary,
    crescitaChart,
    riepilogoChart,
    interazioniChart,
    posts,
    newsletters
  });
}
