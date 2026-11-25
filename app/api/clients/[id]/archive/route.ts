import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser } from '@/lib/api-auth';
import { isAdminUser } from '@/lib/roles';
import { archivePatch } from '@/lib/client-archive';

/**
 * Archivia o ripristina un cliente. Non cancella niente: task, progetti, contenuti e brief restano dove sono (a differenza
 * di DELETE /api/clients/[id]). Solo un amministratore, come per l'eliminazione.
 * Corpo: { archived: boolean }
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request as import('next/server').NextRequest);
  if (!auth) return unauthorizedResponse();
  if (!isAdminUser(await getAppUser(auth.uid))) return forbiddenResponse("Solo un amministratore puo' archiviare un cliente.");

  const body = await request.json().catch(() => null);
  if (!body || typeof body.archived !== 'boolean') {
    return NextResponse.json({ error: 'Indica archived: true oppure false.' }, { status: 400 });
  }

  try {
    const ref = adminDb.collection('clients').doc(params.id);
    if (!(await ref.get()).exists) return NextResponse.json({ error: 'Cliente non trovato.' }, { status: 404 });
    await ref.update(archivePatch(body.archived, new Date().toISOString()));
    return NextResponse.json({ success: true, archived: body.archived });
  } catch (error) {
    console.error(`Error archiving client ${params.id}:`, error);
    return NextResponse.json({ error: 'Failed to archive client' }, { status: 500 });
  }
}
