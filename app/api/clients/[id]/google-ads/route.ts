import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { getGoogleAdsCampaigns } from '@/lib/google-ads-client';

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

  try {
    // Prova a recuperare i dati reali da Google Ads
    const { campaigns, summary } = await getGoogleAdsCampaigns(clientId);

    return NextResponse.json({
      campaigns,
      summary,
      _meta: {
        source: 'live',
        adAccountId: summary.accountId,
      },
    });
  } catch (error: any) {
    console.error(`[google-ads-api] Error for client ${clientId}:`, error.message);

    // Se l'API non è configurata o c'è un errore (es. token mancante), facciamo fallback zero
    const mockSummary = {
      accountId: '',
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
    };

    return NextResponse.json(
      {
        campaigns: [],
        summary: mockSummary,
        _meta: {
          source: 'empty',
          message: 'Google Ads non collegato o errore API. Nessun dato disponibile.',
          errorDetail: error.message
        },
      },
      { status: 200 } // Restituiamo 200 per non far crashare la dashboard
    );
  }
}
