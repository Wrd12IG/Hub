import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { isKpiProfile } from '@/lib/kpi-profiles';
import { isMonthKey } from '@/lib/manual-kpis';
import { readSnapshots } from '@/lib/monthly-mail-store';

export const dynamic = 'force-dynamic';

/**
 * GET ?month=AAAA-MM → i clienti che entrano nella mail (flag acceso e profilo) e le fotografie già calcolate del mese.
 * Solo amministratori.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  if ((await getAppUser(auth.uid))?.role !== 'Amministratore') return forbiddenResponse();

  const month = request.nextUrl.searchParams.get('month');
  if (!isMonthKey(month)) return NextResponse.json({ error: 'Mese non valido (AAAA-MM).' }, { status: 400 });
  try {
    const snap = await adminDb.collection('clients').where('monthlyKpiMail', '==', true).select('name', 'kpiProfile').get();
    const included = snap.docs
      .map((d) => ({ id: d.id, name: String(d.get('name') ?? d.id), profile: d.get('kpiProfile') }))
      .filter((c) => isKpiProfile(c.profile))
      .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));
    return NextResponse.json({ included, snapshots: await readSnapshots(month, included.map((c) => c.id)) });
  } catch (e: any) {
    console.error('[monthly-kpi-mail/snapshots]', e?.message);
    return NextResponse.json({ error: 'Impossibile leggere le fotografie' }, { status: 500 });
  }
}
