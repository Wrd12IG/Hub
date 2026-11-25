import { approvalGate } from '@/lib/content-approval';
import { failureAlerts } from '@/lib/publish-alerts';
import { sendFailureAlerts } from '@/lib/publish-notify';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff, denyUnlessCan } from '@/lib/api-auth';
import { runPublish } from '@/lib/publish-runner';
import type { EditorialContent } from '@/lib/data';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/clients/[id]/editorial-publish-now  { contentId: string }
 * Solo staff. Pubblica subito un contenuto del cliente, senza aspettare la data né la cron, con le stesse protezioni
 * (account del cliente, canale preso in transazione, nessun doppio post). Riprova anche i canali falliti.
 * Il contenuto deve essere già "Approvato": il bypass dell'approvazione resta un'azione separata e con permesso.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;
  // Capacità del ruolo e cliente assegnato: per ora solo osservazione (lib/roles-guard.ts), non blocca
  const roleCheck = await denyUnlessCan(user.uid, 'social.publish', params.id);
  if (roleCheck) return roleCheck;

  const body = await request.json().catch(() => null);
  const contentId = typeof body?.contentId === 'string' ? body.contentId : '';
  if (!contentId) return NextResponse.json({ error: 'Contenuto mancante' }, { status: 400 });

  const snap = await adminDb.collection('editorialContents').doc(contentId).get();
  if (!snap.exists || snap.data()?.clientId !== params.id) return NextResponse.json({ error: 'Contenuto non trovato' }, { status: 404 });
  const content = { id: snap.id, ...(snap.data() as Omit<EditorialContent, 'id'>) } as EditorialContent;
  if (content.status === 'Pubblicato') return NextResponse.json({ error: 'Già pubblicato' }, { status: 409 });
  // Stato «Approvato» e approvazione vera (cliente o amministratore), non modificata dopo: lo stato da solo lo scrive chiunque dello staff.
  const gate = approvalGate(content);
  if (!gate.ok) return NextResponse.json({ error: `Il contenuto non può uscire: ${gate.message}` }, { status: 409 });

  try {
    const outcomes = await runPublish([content], { dryRun: false, resetFailed: true }, Date.now());
    // Tentativo a mano: se fallisce lo si dice subito a chi gestisce il cliente (oltre al messaggio sullo schermo)
    await sendFailureAlerts(failureAlerts(outcomes, true));
    return NextResponse.json({ ok: true, outcomes });
  } catch (error: any) {
    console.error('[publish-now]', error);
    return NextResponse.json({ error: error?.message || 'Errore durante la pubblicazione' }, { status: 500 });
  }
}
