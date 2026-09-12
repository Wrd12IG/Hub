import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser, ownsClientResource } from '@/lib/api-auth';
import { getClientMarketingReport } from '@/lib/reporting';
import type { Client } from '@/lib/data';

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

    const report = await getClientMarketingReport(client, datePreset);

    return NextResponse.json({ clientId, datePreset, platforms: report });
  } catch (error: any) {
    console.error(`[reporting] Error building report for client ${clientId}:`, error);
    return NextResponse.json({ error: 'Failed to build marketing report' }, { status: 500 });
  }
}
