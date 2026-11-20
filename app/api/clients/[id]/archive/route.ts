import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser } from '@/lib/api-auth';
import { setClientArchived } from '@/lib/client-archive';

/** POST { archived: boolean }: archivia o riattiva un cliente (solo amministratori). Vedi lib/client-archive.ts. */
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  if ((await getAppUser(auth.uid))?.role !== 'Amministratore') return forbiddenResponse("Solo un amministratore puo' archiviare un cliente.");
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 }); }
  if (typeof body?.archived !== 'boolean') return NextResponse.json({ error: 'Indica se archiviare o riattivare.' }, { status: 400 });
  try {
    const r = await setClientArchived(adminDb, adminAuth, params.id, body.archived);
    return NextResponse.json({ ok: true, archived: body.archived, ...r });
  } catch (e: any) {
    if (e?.message === 'not-found') return NextResponse.json({ error: 'Cliente non trovato.' }, { status: 404 });
    console.error('[clients/archive]', e);
    return NextResponse.json({ error: 'Operazione non riuscita.' }, { status: 500 });
  }
}
