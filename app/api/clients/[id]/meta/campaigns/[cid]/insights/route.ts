/**
 * GET /api/clients/[id]/meta/campaigns/[cid]/insights?datePreset=last_30d
 *
 * Report di una singola campagna Meta, per il modale «Report» della tab Campagne.
 *
 * Prima chiedeva a Meta un token OAuth *per singolo cliente* (che nessun cliente ha) e restituiva comunque
 * `{ data }`, mentre il modale legge `{ base, specific }`: su qualunque campagna, anche attiva e con dati, finiva
 * nell'errore «Impossibile caricare il report». Ora legge Windsor, la stessa fonte della tab Campagne.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getData } from '@/lib/windsor-client';
import { CAMPAIGN_REPORT_FIELDS, buildCampaignReport, presetDates } from '@/lib/meta-campaign-report';

export const maxDuration = 60;

export async function GET(request: NextRequest, { params }: { params: { id: string; cid: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(user.uid, params.id);
  if (denied) return denied;

  const snap = await adminDb.collection('clients').doc(params.id).get();
  const accountId = snap.exists ? (snap.data() as any)?.metaAdAccountId : null;
  if (!accountId) {
    return NextResponse.json({ error: 'Questo cliente non ha un Meta Ad Account ID: inseriscilo in Setup API.' }, { status: 503 });
  }

  const sp = request.nextUrl.searchParams;
  const { from, to } = presetDates(sp.get('datePreset') || 'last_30d');

  try {
    const rows = await getData({ connector: 'facebook', accountId, fields: CAMPAIGN_REPORT_FIELDS, dateFrom: from, dateTo: to, fresh: sp.get('refresh') === '1' });
    const mine = rows.filter((r: any) => String(r.campaign_id ?? '') === params.cid);
    return NextResponse.json({ ...buildCampaignReport(mine as any, sp.get('objective') || undefined), campaignId: params.cid, from, to });
  } catch (error: any) {
    console.error(`[meta/campaigns/insights] ${params.id}/${params.cid}:`, error?.message);
    return NextResponse.json({ error: 'Impossibile leggere i dati della campagna al momento.' }, { status: 503 });
  }
}
