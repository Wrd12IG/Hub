import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, getAppUser, forbiddenResponse, unauthorizedResponse } from '@/lib/api-auth';
import { canViewFinancialsServer } from '@/lib/financial-access';
import { readAllCompensation, saveCompensation, splitCompensation } from '@/lib/user-compensation';

/**
 * Stipendio e costo orario delle persone (area riservata: lib/user-compensation.ts).
 *  - GET: chi ha il permesso finanziario (amministratore sempre) riceve {uid: {salary, hourlyRate}}; gli altri una lista vuota.
 *  - PUT { userId, salary?, hourlyRate? }: solo amministratori.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const me = await getAppUser(auth.uid);
  if (!(await canViewFinancialsServer(adminDb, me))) return NextResponse.json({});
  try {
    return NextResponse.json(await readAllCompensation(adminDb));
  } catch (e) {
    console.error('[api/users/compensation] lettura fallita:', e);
    return NextResponse.json({ error: 'Impossibile leggere i costi orari.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  if ((await getAppUser(auth.uid))?.role !== 'Amministratore') return forbiddenResponse("Solo un amministratore puo' modificare stipendi e costi orari.");
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 }); }
  const userId = String(body?.userId || '');
  if (!userId) return NextResponse.json({ error: 'Utente mancante.' }, { status: 400 });
  if (!(await adminDb.collection('users').doc(userId).get()).exists) return NextResponse.json({ error: 'Utente non trovato.' }, { status: 404 });
  const { fields } = splitCompensation(body);
  await saveCompensation(adminDb, userId, fields);
  return NextResponse.json({ ok: true });
}
