import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { listAccessibleCustomers } from '@/lib/google-ads-client';

// Questa route legge gli header a ogni richiesta, quindi non può essere
// prerenderizzata. Senza questa riga Next.js ci prova comunque in build, il
// tentativo esplode con DYNAMIC_SERVER_USAGE e il log si riempie di stack
// trace che sembrano guasti e non lo sono. Per una route di cron il rischio è
// peggiore del rumore: una risposta messa in cache staticamente risponderebbe
// sempre la stessa cosa senza eseguire nulla.
export const dynamic = 'force-dynamic';

export const maxDuration = 60;

/**
 * GET /api/google-ads/customers
 *
 * Gli account Google Ads accessibili con le credenziali d'agenzia.
 *
 * La versione precedente era rotta due volte: usava **API v17**, che oggi
 * risponde 404, e leggeva GOOGLE_REFRESH_TOKEN / GOOGLE_CLIENT_ID, variabili
 * che sul progetto Vercel del Hub non esistono (stanno su quello della
 * dashboard). Pretendeva inoltre GOOGLE_ADS_DEVELOPER_TOKEN come
 * obbligatorio, mentre Google lo sta dismettendo.
 *
 * Ora usa lo stesso client del resto del Hub: v24, credenziali d'agenzia,
 * nessun developer token.
 */
export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;

  try {
    const customers = await listAccessibleCustomers();
    return NextResponse.json({ customers, count: customers.length });
  } catch (err: any) {
    console.error('[google-ads/customers] fallita:', err.message);
    return NextResponse.json({ error: err.message, customers: [] }, { status: 503 });
  }
}
