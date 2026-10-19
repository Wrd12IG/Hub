import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { migrateClientPrivate } from '@/lib/client-private-migrate';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/migrate-client-private  { mode: 'prova' | 'copia' | 'rimuovi' }
 *
 * Migrazione di mediaPlan e postLead nella sottocollezione solo-staff, lanciata dal sito perché le credenziali Firebase
 * stanno su Vercel (segnate «sensibili», non si scaricano in locale). Solo amministratori.
 *  - prova: non scrive nulla
 *  - copia: copia nella sottocollezione, senza toccare l'originale
 *  - rimuovi: come copia, e toglie il vecchio campo solo dove la copia riletta è identica
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const user = await getAppUser(auth.uid);
  if (user?.role !== 'Amministratore') return forbiddenResponse();

  const body = await request.json().catch(() => ({}));
  const mode = body?.mode;
  if (mode !== 'prova' && mode !== 'copia' && mode !== 'rimuovi') {
    return NextResponse.json({ error: 'mode deve essere prova, copia o rimuovi' }, { status: 400 });
  }
  try {
    const result = await migrateClientPrivate(adminDb, { apply: mode !== 'prova', deleteLegacy: mode === 'rimuovi' });
    return NextResponse.json({ mode, ...result });
  } catch (err: any) {
    console.error('[migrate-client-private]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
