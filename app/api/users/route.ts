import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyAuth, getAppUser, forbiddenResponse } from '@/lib/api-auth';

/**
 * Creazione utenti lato server.
 *
 * Prima girava nel browser con createUserWithEmailAndPassword dell'SDK client,
 * che ha due effetti collaterali gravi:
 *
 *  1. cambia la sessione del browser: chi crea l'utente viene sloggato e
 *     diventa l'utente appena creato;
 *  2. la scrittura del profilo su Firestore parte subito dopo e quindi gira
 *     con i permessi del nuovo utente, che non ha ancora un profilo. La regola
 *     `allow create: if isAdmin()` legge il ruolo da quel documento inesistente
 *     e nega. Risultato: account valido in Authentication, profilo mancante, e
 *     l'app butta fuori la persona a ogni accesso (layout-context.tsx: "User
 *     profile not found in Firestore. Logging out.").
 *
 * Qui l'Admin SDK scavalca le regole e crea account e profilo nella stessa
 * richiesta. Se la scrittura del profilo fallisce, l'account appena creato
 * viene rimosso: meglio nessun utente che un utente a meta'.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const caller = await verifyAuth(request);
  if (!caller) return NextResponse.json({ error: 'Non autenticato.' }, { status: 401 });

  const me = await getAppUser(caller.uid);
  if (me?.role !== 'Amministratore') return forbiddenResponse('Solo un amministratore puo\' creare utenti.');

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 }); }

  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  const profile = (body?.profile && typeof body.profile === 'object') ? body.profile : {};

  if (!email) return NextResponse.json({ error: "L'indirizzo email e' obbligatorio." }, { status: 400 });

  // L'account potrebbe gia' esistere in Authentication senza profilo: e' il
  // residuo del bug precedente. In quel caso non si ricrea nulla, si completa.
  let uid: string | null = null;
  try {
    uid = (await adminAuth.getUserByEmail(email)).uid;
  } catch {
    uid = null;
  }

  const riparazione = uid !== null;

  if (riparazione) {
    const esistente = await adminDb.collection('users').doc(uid!).get();
    if (esistente.exists) {
      return NextResponse.json({ error: 'Esiste gia\' un utente completo con questa email.' }, { status: 409 });
    }
  } else {
    if (password.length < 6) {
      return NextResponse.json({ error: 'La password deve essere di almeno 6 caratteri.' }, { status: 400 });
    }
    try {
      uid = (await adminAuth.createUser({ email, password, displayName: profile.name || undefined })).uid;
    } catch (e: any) {
      const code = e?.errorInfo?.code || e?.code || '';
      if (code.includes('invalid-email')) return NextResponse.json({ error: "L'indirizzo email non e' valido." }, { status: 400 });
      if (code.includes('invalid-password')) return NextResponse.json({ error: 'Password non valida.' }, { status: 400 });
      console.error('[api/users] createUser fallita:', e);
      return NextResponse.json({ error: "Impossibile creare l'account." }, { status: 500 });
    }
  }

  const dati: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(profile)) if (v !== undefined) dati[k] = v;

  try {
    await adminDb.collection('users').doc(uid!).set({
      ...dati,
      email,
      status: (profile.status as string) || 'Attivo',
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });
  } catch (e) {
    // Mai lasciare un account senza profilo: e' proprio il guasto che questa
    // rotta esiste per impedire.
    if (!riparazione) await adminAuth.deleteUser(uid!).catch(() => {});
    console.error('[api/users] scrittura profilo fallita:', e);
    return NextResponse.json({ error: 'Account non creato: scrittura del profilo fallita.' }, { status: 500 });
  }

  return NextResponse.json({ uid, riparato: riparazione });
}
