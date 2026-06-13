import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const id = params.id;

  if (!id) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
  }

  // --- Mock Data ---

  const coperturaSummary = {
    googleMaps: 0,
    ricercaGoogle: 0,
    totale: 0
  };

  const clicSummary = {
    sitoWeb: 0,
    telefono: 0,
    indirizzo: 0,
    totale: 0
  };

  const recensioniSummary = {
    valutazione: 0,
    totale: 0
  };

  const distribuzioneCopertura: any[] = [];
  const paroleChiave: any[] = [];
  const recensioni: any[] = [];

  // Utility to generate dynamic charts for the 56 days
  const generateChartData = (days = 56, type: 'copertura' | 'clic' | 'recensioni'): any[] => {
    return Array.from({ length: days }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dateString = date.toISOString().split('T')[0];
      
      if (type === 'copertura') {
        return {
          date: dateString,
          googleMaps: 0,
          ricercaGoogle: 0,
          totale: 0
        };
      }
      
      if (type === 'clic') {
        return {
          date: dateString,
          sitoWeb: 0,
          telefono: 0,
          indirizzo: 0,
          totale: 0
        };
      }
      
      if (type === 'recensioni') {
        return {
          date: dateString,
          valutazione: null,
          totale: 0
        };
      }
      
      return { date: dateString };
    });
  };

  const data = {
    coperturaSummary,
    clicSummary,
    recensioniSummary,
    coperturaChart: generateChartData(56, 'copertura'),
    clicChart: generateChartData(56, 'clic'),
    recensioniChart: generateChartData(56, 'recensioni'),
    distribuzioneCopertura,
    paroleChiave,
    recensioni
  };

  return NextResponse.json(data);
}
