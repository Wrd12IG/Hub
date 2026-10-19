import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff, denyUnlessClientAllowed } from '@/lib/api-auth';
import { cleanCommentText, currentMonth, isValidMonth } from '@/lib/monthly-comment';

// Commento mensile sui risultati del cliente, mostrato nella pagina pubblica. Lo scrive solo lo staff.
const docRef = (clientId: string, month: string) =>
  adminDb.collection('clients').doc(clientId).collection('comments').doc(month);

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request as import('next/server').NextRequest);
  if (!auth) return unauthorizedResponse();
  // Lettura anche per l'utente «Cliente» di questo cliente (vede il commento in sola lettura); la scrittura resta dello staff
  const denied = await denyUnlessClientAllowed(auth.uid, params.id);
  if (denied) return denied;

  const month = new URL(request.url).searchParams.get('month') || currentMonth();
  if (!isValidMonth(month)) return NextResponse.json({ error: 'Mese non valido' }, { status: 400 });

  const snap = await docRef(params.id, month).get();
  const d = snap.exists ? (snap.data() as any) : null;
  return NextResponse.json({ month, text: d?.text ?? '', updatedAt: d?.updatedAt ?? null });
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request as import('next/server').NextRequest);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessStaff(auth.uid);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  if (!isValidMonth(body?.month)) return NextResponse.json({ error: 'Mese non valido' }, { status: 400 });
  const text = cleanCommentText(body?.text);
  if (text === null) return NextResponse.json({ error: 'Testo non valido o troppo lungo' }, { status: 400 });

  const client = await adminDb.collection('clients').doc(params.id).get();
  if (!client.exists) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

  const updatedAt = new Date().toISOString();
  // Testo vuoto = commento tolto: la pagina pubblica non mostra nulla invece di un riquadro vuoto.
  if (text === '') await docRef(params.id, body.month).delete();
  else await docRef(params.id, body.month).set({ text, authorUid: auth.uid, updatedAt });
  return NextResponse.json({ month: body.month, text, updatedAt });
}
