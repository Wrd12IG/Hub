import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { isKpiProfile } from '@/lib/kpi-profiles';
import { isMonthKey } from '@/lib/manual-kpis';
import { buildMonthlyMail } from '@/lib/monthly-mail-html';
import { readSnapshots } from '@/lib/monthly-mail-store';
import { sendMonthlyMail } from '@/lib/monthly-mail-send';

export const dynamic = 'force-dynamic';

/**
 * POST { month } → manda la mail di PROVA, solo all'indirizzo di chi la chiede (mai ai destinatari veri). Usa le
 * fotografie già calcolate: chi non ne ha non compare e il numero viene restituito. Solo amministratori.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const me = await getAppUser(auth.uid);
  if (me?.role !== 'Amministratore') return forbiddenResponse();
  // L'indirizzo è quello verificato nel token di chi chiede, non uno passato nel corpo: la prova non può andare altrove
  const to = auth.email;
  if (!to) return NextResponse.json({ error: 'Il tuo accesso non ha un indirizzo mail.' }, { status: 400 });

  const body = await request.json().catch(() => null);
  if (!body || !isMonthKey(body.month)) return NextResponse.json({ error: 'Mese non valido (AAAA-MM).' }, { status: 400 });

  try {
    const snap = await adminDb.collection('clients').where('monthlyKpiMail', '==', true).select('kpiProfile').get();
    const ids = snap.docs.filter((d) => isKpiProfile(d.get('kpiProfile'))).map((d) => d.id);
    const shots = await readSnapshots(body.month, ids);
    const clients = Object.values(shots).map((s) => s.result);
    if (clients.length === 0) return NextResponse.json({ error: 'Nessun cliente calcolato per questo mese: premi prima «Calcola».' }, { status: 409 });

    const mail = buildMonthlyMail({ month: body.month, clients, baseUrl: request.nextUrl.origin });
    const sent = await sendMonthlyMail({ to: [to], subject: `[PROVA] ${mail.subject}`, html: mail.html, text: mail.text });
    if (!sent.success) return NextResponse.json({ error: `Invio non riuscito: ${sent.error}` }, { status: 502 });
    return NextResponse.json({ sentTo: to, from: sent.from, clients: clients.length, missing: ids.length - clients.length, bytes: mail.bytes });
  } catch (e: any) {
    console.error('[monthly-kpi-mail/send-test]', e?.message);
    return NextResponse.json({ error: 'Invio di prova non riuscito' }, { status: 500 });
  }
}
