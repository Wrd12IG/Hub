import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser } from '@/lib/api-auth';
import { isAdminUser } from '@/lib/roles';
import { clientImpact } from '@/lib/client-delete';

/** Cosa sparirebbe eliminando il cliente: serve alla conferma, per dire i numeri veri prima di chiedere «sei sicuro?». Non cancella nulla. */
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  if (!isAdminUser(await getAppUser(auth.uid))) return forbiddenResponse("Solo un amministratore puo' eliminare un cliente.");
  const exists = (await adminDb.collection('clients').doc(params.id).get()).exists;
  if (!exists) return NextResponse.json({ error: 'Cliente non trovato.' }, { status: 404 });
  return NextResponse.json(await clientImpact(adminDb, params.id));
}
