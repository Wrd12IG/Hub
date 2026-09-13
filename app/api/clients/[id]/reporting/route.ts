import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser, ownsClientResource } from '@/lib/api-auth';
import { getClientMarketingReport, buildWindows, type CompareMode } from '@/lib/reporting';
import { getClientToken } from '@/lib/api-auth';
import type { Client } from '@/lib/data';

// Il report interroga più piattaforme insieme e alcune sono lente (Google Ads
// su Windsor risponde in ~13s, misurato). Senza un tetto esplicito Vercel usa
// il default e uccide la richiesta a metà: il client non riceve una risposta
// parziale, non ne riceve nessuna. Il limite per singola piattaforma sta in
// lib/reporting.ts; questo è il tetto complessivo.
export const maxDuration = 60;


export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuth(request as import('next/server').NextRequest);
  if (!auth) return unauthorizedResponse();

  const clientId = params.id;

  // Authorization: staff can view any client's report; a "Cliente"-role user can
  // only view the report for their own client — this exposes real ad-spend/
  // performance data, so ownership matters here even where an older route
  // (GET /api/clients/[id]) currently doesn't check it.
  const user = await getAppUser(auth.uid);
  if (!isStaffUser(user) && !ownsClientResource(user, clientId)) return forbiddenResponse();

  try {
    const clientSnap = await adminDb.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    const client = clientSnap.data() as Client;

    const { searchParams } = new URL(request.url);
    const datePreset = searchParams.get('date_preset') || 'last_30d';
    const days = parseInt(searchParams.get('days') || '', 10);
    const compare = (searchParams.get('compare') || 'none') as CompareMode;

    // Explicit windows are only needed for a comparison; without one the
    // simpler date_preset path is kept.
    const windows = Number.isFinite(days) && compare !== 'none'
        ? buildWindows(days, compare)
        : undefined;

    // La chiave Klaviyo vive cifrata nella sottocollection `integrations`, non
    // sul documento del cliente: la si risolve qui e la si passa, così
    // lib/reporting.ts resta senza dipendenze da Firestore. Un errore nel
    // leggerla non deve far cadere tutto il resto del report.
    const klaviyoToken = await getClientToken(clientId, 'klaviyo').catch(() => null);
    const klaviyo = klaviyoToken?.accessToken
      ? {
          apiKey: klaviyoToken.accessToken,
          conversionMetricId: klaviyoToken.extra?.conversionMetricId,
          // Chiave di cache: l'endpoint dei report Klaviyo accetta 2 richieste
          // al minuto, quindi senza cache la scheda sarebbe in errore quasi
          // sempre. Vedi lib/klaviyo-client.ts.
          cacheKey: clientId,
        }
      : undefined;

    const report = await getClientMarketingReport({ ...client, klaviyo }, datePreset, windows);

    return NextResponse.json({ clientId, datePreset, compare, windows: windows ?? null, platforms: report });
  } catch (error: any) {
    console.error(`[reporting] Error building report for client ${clientId}:`, error);
    return NextResponse.json({ error: 'Failed to build marketing report' }, { status: 500 });
  }
}
