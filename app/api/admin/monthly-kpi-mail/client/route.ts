import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser } from '@/lib/api-auth';
import { isMonthKey } from '@/lib/manual-kpis';
import { computeClientMonth } from '@/lib/kpi-monthly';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST { clientId, month } → calcola i KPI di UN cliente per il mese (legge le piattaforme, 10-40 s) e ne salva la
 * fotografia. Un cliente per chiamata: il limite di Vercel è 60 secondi, quindi chi vuole calcolarli tutti li chiama uno
 * alla volta (la pagina di anteprima, il giro automatico). Solo amministratori.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  if ((await getAppUser(auth.uid))?.role !== 'Amministratore') return forbiddenResponse();

  const body = await request.json().catch(() => null);
  if (!body || typeof body.clientId !== 'string' || !body.clientId || !isMonthKey(body.month)) {
    return NextResponse.json({ error: 'Servono clientId e month (AAAA-MM).' }, { status: 400 });
  }
  try {
    const out = await computeClientMonth(body.clientId, body.month);
    if (!out.ok) return NextResponse.json({ error: out.message }, { status: out.reason === 'not_found' ? 404 : 400 });
    return NextResponse.json({ result: out.result });
  } catch (e: any) {
    console.error(`[monthly-kpi-mail/client] ${body.clientId}:`, e?.message);
    return NextResponse.json({ error: 'Calcolo non riuscito' }, { status: 500 });
  }
}
