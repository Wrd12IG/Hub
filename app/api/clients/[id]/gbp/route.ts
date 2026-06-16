/**
 * GET /api/clients/[id]/gbp
 *
 * Google Business Profile data.
 * Se non configurato → 503 con notConfigured:true (NO dati finti a zero).
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, getClientToken } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const { id: clientId } = params;

  if (!clientId) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
  }

  // Controlla se le credenziali GBP sono configurate
  const tokenData = await getClientToken(clientId, 'google').catch(() => null);

  if (!tokenData?.accessToken) {
    return NextResponse.json(
      {
        notConfigured: true,
        _meta: {
          source: 'empty',
          hint: 'Collega Google Business Profile nella scheda ⚙️ Setup API.',
        },
      },
      { status: 503 }
    );
  }

  // TODO: implementare chiamata reale a Google Business Profile API v4
  // GET https://mybusinessbusinessinformation.googleapis.com/v1/accounts/{accountId}/locations
  return NextResponse.json(
    {
      notConfigured: true,
      _meta: {
        source: 'empty',
        hint: 'Integrazione GBP in arrivo. Dati reali disponibili presto.',
      },
    },
    { status: 503 }
  );
}
