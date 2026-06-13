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
    visualizzazioni: 0,
    miPiace: 0,
    nonMiPiace: 0,
    commenti: 0,
    condivisi: 0,
    iscrittiGuadagnati: 0,
    iscrittiPersi: 0,
    iscrittiVideo: 0
  };

  const interactionChart = Array.from({ length: 56 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (55 - i));
    
    return {
      date: date.toISOString().split('T')[0],
      visualizzazioni: 0,
      miPiace: 0,
      nonMiPiace: 0,
      commenti: 0,
      condiviso: 0
    };
  });

  const subscriberChart = Array.from({ length: 56 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (55 - i));
    
    return {
      date: date.toISOString().split('T')[0],
      guadagnato: 0,
      perso: 0,
      video: 0
    };
  });

  const demographics = {
    genere: [],
    eta: [],
    paese: [],
    traffico: []
  };

  return NextResponse.json({
    summary,
    interactionChart,
    subscriberChart,
    videos: mockVideos,
    demographics
  });
}
