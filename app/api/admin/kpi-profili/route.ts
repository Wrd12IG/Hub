import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser } from '@/lib/api-auth';
import { isAdminUser } from '@/lib/roles';
import { adminDb } from '@/lib/firebase-admin';
import { isArchivedClient } from '@/lib/client-archive';
import { isKpiProfile } from '@/lib/kpi-profiles';
import { isMonthKey } from '@/lib/manual-kpis';
import { readSnapshots } from '@/lib/monthly-mail-store';

export const dynamic = 'force-dynamic';

/**
 * GET ?month=AAAA-MM&profile=auto|ecommerce|locale|b2b|social
 * → i clienti attivi di quel profilo e le «fotografie» mensili già calcolate (le stesse di Andamento clienti e della mail).
 * Non chiama nessuna piattaforma: legge solo ciò che è già salvato, quindi risponde subito. Solo amministratori,
 * come Andamento clienti.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  if (!isAdminUser(await getAppUser(auth.uid))) return forbiddenResponse();

  const month = request.nextUrl.searchParams.get('month');
  const profile = request.nextUrl.searchParams.get('profile');
  if (!isMonthKey(month)) return NextResponse.json({ error: 'Mese non valido (AAAA-MM).' }, { status: 400 });
  if (!isKpiProfile(profile)) return NextResponse.json({ error: 'Profilo non valido.' }, { status: 400 });

  try {
    const snap = await adminDb.collection('clients').where('kpiProfile', '==', profile).select('name', 'archived', 'monthlyKpiMail').get();
    const clients = snap.docs
      .filter((d) => !isArchivedClient({ archived: d.get('archived') }))
      .map((d) => ({ id: d.id, name: String(d.get('name') ?? d.id).trim(), inMail: d.get('monthlyKpiMail') === true }));
    return NextResponse.json({ profile, month, clients, snapshots: await readSnapshots(month, clients.map((c) => c.id)) });
  } catch (e: any) {
    console.error('[kpi-profili]', e?.message);
    return NextResponse.json({ error: 'Impossibile leggere i KPI' }, { status: 500 });
  }
}
