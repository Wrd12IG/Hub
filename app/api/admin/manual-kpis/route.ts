import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { isMonthKey } from '@/lib/manual-kpis';
import { readManualKpis, writeManualKpis } from '@/lib/monthly-mail-store';

export const dynamic = 'force-dynamic';

async function requireStaff(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return { res: unauthorizedResponse(), uid: '' };
  if (!isStaffUser(await getAppUser(auth.uid))) return { res: forbiddenResponse(), uid: '' };
  return { res: null, uid: auth.uid };
}

/**
 * GET /api/admin/manual-kpis?month=AAAA-MM → { values: { [clientId]: { leads_real, … } } }
 * I dati reali del mese per i clienti che entrano nella mail mensile. Solo staff.
 */
export async function GET(request: NextRequest) {
  const { res } = await requireStaff(request);
  if (res) return res;
  const month = request.nextUrl.searchParams.get('month');
  if (!isMonthKey(month)) return NextResponse.json({ error: 'Mese non valido (AAAA-MM).' }, { status: 400 });
  try {
    const clients = await adminDb.collection('clients').where('monthlyKpiMail', '==', true).select().get();
    return NextResponse.json({ values: await readManualKpis(clients.docs.map((d) => d.id), month) });
  } catch (e: any) {
    console.error('[admin/manual-kpis] GET:', e?.message);
    return NextResponse.json({ error: 'Impossibile leggere i dati' }, { status: 500 });
  }
}

/**
 * PUT { month, entries: { [clientId]: { leads_real: 12, sales: null } } }: un numero imposta il valore, null lo toglie,
 * un campo non indicato resta com'è. Risponde con i clienti salvati e quelli scartati. Solo staff.
 */
export async function PUT(request: NextRequest) {
  const { res, uid } = await requireStaff(request);
  if (res) return res;
  const body = await request.json().catch(() => null);
  if (!body || !isMonthKey(body.month)) return NextResponse.json({ error: 'Mese non valido (AAAA-MM).' }, { status: 400 });
  if (!body.entries || typeof body.entries !== 'object' || Array.isArray(body.entries)) return NextResponse.json({ error: 'Dati non validi.' }, { status: 400 });
  if (Object.keys(body.entries).length > 200) return NextResponse.json({ error: 'Troppi clienti in una volta.' }, { status: 400 });
  try {
    return NextResponse.json(await writeManualKpis(body.month, body.entries, uid));
  } catch (e: any) {
    console.error('[admin/manual-kpis] PUT:', e?.message);
    return NextResponse.json({ error: 'Impossibile salvare' }, { status: 500 });
  }
}
