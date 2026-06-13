/**
 * GET /api/clients/[id]/gbp/locations
 * Lista sedi Google Business Profile del cliente
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { getGBPLocations } from '@/lib/gbp-client';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;

  try {
    const locations = await getGBPLocations(clientId);

    return NextResponse.json({
      locations,
      _meta: { source: 'live' },
    });
  } catch (error: any) {
    console.warn(`[gbp/locations] Error for client ${clientId}, serving mock data. Detail:`, error.message);
    
    // In caso di errore (es: credenziali non inserite), facciamo fallback zero
    return NextResponse.json(
      {
        locations: [],
        _meta: { source: 'empty', message: 'Google Business non collegato.', errorDetail: error.message },
      },
      { status: 200 }
    );
  }
}

