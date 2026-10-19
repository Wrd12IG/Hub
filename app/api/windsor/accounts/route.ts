import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser } from '@/lib/api-auth';
import { ACCOUNT_CONNECTORS, ConnectorNotActive, listAccounts, type AccountConnector } from '@/lib/windsor-accounts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/windsor/accounts?connector=instagram|facebook_organic|linkedin_organic|google_my_business
 * Elenco {id, name} degli account disponibili, per sceglierli da una lista in Setup API. Solo staff.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  if (!isStaffUser(await getAppUser(auth.uid))) return forbiddenResponse();

  const connector = request.nextUrl.searchParams.get('connector') as AccountConnector;
  if (!ACCOUNT_CONNECTORS.includes(connector)) return NextResponse.json({ error: 'Collegamento non valido' }, { status: 400 });

  try {
    return NextResponse.json({ accounts: await listAccounts(connector) });
  } catch (err: any) {
    if (err instanceof ConnectorNotActive) return NextResponse.json({ accounts: [], notActive: true, message: err.message });
    console.error(`[windsor/accounts] ${connector}:`, err.message);
    return NextResponse.json({ error: 'Elenco non disponibile al momento' }, { status: 503 });
  }
}
