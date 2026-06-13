import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const { id } = params;

  if (!id) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
  }

  const mockVideos: any[] = [];

  const summary = {
    followers: 0,
    post: 0,
    acquisito: 0,
    perso: 0,
    engagement: 0,
    interazioni: 0,
    coperturaMedia: 0,
    visualizzazioni: 0,
    miPiace: 0,
    commenti: 0,
    condivisi: 0,
    visualizzazioniProfilo: 0
  };

  const generateEmptyChart = (days = 56, extraFields = {}) => {
    return Array.from({ length: days }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      return {
        date: date.toISOString().split('T')[0],
        ...extraFields
      };
    });
  };

  const crescitaChart = generateEmptyChart(56, { followers: 0, post: 0 });
  const saldoFollowersChart = generateEmptyChart(56, { acquisito: 0, perso: 0, post: 0 });
  const riepilogoChart = generateEmptyChart(56, { engagement: 0, interazioni: 0, coperturaMedia: 0, visualizzazioni: 0, post: 0 });
  const interazioniChart = generateEmptyChart(56, { miPiace: 0, commenti: 0, condivisi: 0, post: 0 });
  const profiloChart = generateEmptyChart(56, { visualizzazioni: 0, post: 0 });
  const postVisualizzatiChart = generateEmptyChart(56, { visualizzazioni: 0, miPiace: 0, commenti: 0, condivisi: 0 });
  const medieVisualizzazioniChart = generateEmptyChart(56, { tempoMedioGuardato: 0, durataMediaVideo: 0 });

  return NextResponse.json({
    summary,
    crescitaChart,
    saldoFollowersChart,
    riepilogoChart,
    interazioniChart,
    profiloChart,
    postVisualizzatiChart,
    medieVisualizzazioniChart,
    posts: mockVideos
  });
}
