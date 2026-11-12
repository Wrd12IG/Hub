import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyAuth, getAppUser, forbiddenResponse } from '@/lib/api-auth';

/**
 * Disattivare ed eliminare un utente, lato server (solo amministratori).
 *
 * Prima «Disattiva» non faceva niente, lo stato «Inattivo» non toglieva l'accesso e «Elimina» cancellava soltanto il
 * profilo nel database: l'account di accesso restava, con la sua password. Qui si lavora sull'account vero
 * (Authentication) oltre che sul profilo, e si tolgono anche le sessioni già aperte.
 *
 *  - PATCH { status: 'Inattivo' | 'Attivo' }: blocca o riapre l'accesso. I suoi task e il suo storico restano.
 *  - DELETE: toglie account e profilo. Task, ore e commenti restano al loro posto con il suo nome nello storico.
 *
 * Due paracadute: nessuno può disattivare o eliminare sé stesso, e non si può togliere l'ultimo amministratore attivo.
 */
export const dynamic = 'force-dynamic';

async function guard(request: Request, targetId: string) {
  const caller = await verifyAuth(request);
  if (!caller) return { error: NextResponse.json({ error: 'Non autenticato.' }, { status: 401 }) };
  const me = await getAppUser(caller.uid);
  if (me?.role !== 'Amministratore') return { error: forbiddenResponse("Solo un amministratore puo' farlo.") };
  if (caller.uid === targetId) return { error: NextResponse.json({ error: 'Non puoi farlo su te stesso.' }, { status: 400 }) };
  const snap = await adminDb.collection('users').doc(targetId).get();
  if (!snap.exists) return { error: NextResponse.json({ error: 'Utente non trovato.' }, { status: 404 }) };
  return { target: { id: snap.id, ...(snap.data() as { role?: string; status?: string; name?: string }) } };
}

/** Restano altri amministratori attivi oltre a questo utente? */
async function otherActiveAdmins(targetId: string): Promise<number> {
  const snap = await adminDb.collection('users').where('role', '==', 'Amministratore').get();
  return snap.docs.filter((d) => d.id !== targetId && d.get('status') !== 'Inattivo').length;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const g = await guard(request, params.id);
  if (g.error) return g.error;

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 }); }
  const status = body?.status;
  if (status !== 'Attivo' && status !== 'Inattivo') return NextResponse.json({ error: 'Stato non valido.' }, { status: 400 });

  if (status === 'Inattivo' && g.target!.role === 'Amministratore' && (await otherActiveAdmins(params.id)) === 0) {
    return NextResponse.json({ error: "Non si puo' disattivare l'ultimo amministratore attivo." }, { status: 409 });
  }

  // Prima l'account, poi il profilo: se l'account non si aggiorna, lo stato mostrato non deve mentire.
  try {
    await adminAuth.updateUser(params.id, { disabled: status === 'Inattivo' });
    if (status === 'Inattivo') await adminAuth.revokeRefreshTokens(params.id);
  } catch (e: any) {
    // Profilo senza account (residuo di vecchi errori): niente da bloccare, si aggiorna solo lo stato.
    const code = e?.errorInfo?.code || e?.code || '';
    if (!code.includes('user-not-found')) {
      console.error('[api/users/[id]] aggiornamento account fallito:', e);
      return NextResponse.json({ error: "Impossibile aggiornare l'account di accesso." }, { status: 500 });
    }
  }
  await adminDb.collection('users').doc(params.id).update({ status, updatedAt: new Date().toISOString() });
  return NextResponse.json({ ok: true, status });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const g = await guard(request, params.id);
  if (g.error) return g.error;

  if (g.target!.role === 'Amministratore' && g.target!.status !== 'Inattivo' && (await otherActiveAdmins(params.id)) === 0) {
    return NextResponse.json({ error: "Non si puo' eliminare l'ultimo amministratore attivo." }, { status: 409 });
  }

  // Account prima del profilo: un profilo senza account e' inoffensivo, un account senza profilo butta fuori chi accede.
  try {
    await adminAuth.deleteUser(params.id);
  } catch (e: any) {
    const code = e?.errorInfo?.code || e?.code || '';
    if (!code.includes('user-not-found')) {
      console.error('[api/users/[id]] eliminazione account fallita:', e);
      return NextResponse.json({ error: "Impossibile eliminare l'account di accesso." }, { status: 500 });
    }
  }
  await adminDb.collection('users').doc(params.id).delete();
  return NextResponse.json({ ok: true });
}
