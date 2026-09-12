import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser, ownsClientResource } from '@/lib/api-auth';
import { getClientMarketingReport, buildWindows, type CompareMode } from '@/lib/reporting';
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
    const days = parseInt(searchParams.get('days') || '', 10);
    const compare = (searchParams.get('compare') || 'none') as CompareMode;

    // Explicit windows are only needed for a comparison; without one the
    // simpler date_preset path is kept.
    const windows = Number.isFinite(days) && compare !== 'none'
        ? buildWindows(days, compare)
        : undefined;

    const report = await getClientMarketingReport(client, datePreset, windows);

    return NextResponse.json({ clientId, datePreset, compare, windows: windows ?? null, platforms: report });
  } catch (error: any) {
    console.error(`[reporting] Error building report for client ${clientId}:`, error);
    return NextResponse.json({ error: 'Failed to build marketing report' }, { status: 500 });
  }
}
