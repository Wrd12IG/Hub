import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
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

  const body = await request.json().catch(() => null);
  const contentId = typeof body?.contentId === 'string' ? body.contentId : '';
  if (!contentId) return NextResponse.json({ error: 'Contenuto mancante' }, { status: 400 });

  const snap = await adminDb.collection('editorialContents').doc(contentId).get();
  if (!snap.exists || snap.data()?.clientId !== params.id) return NextResponse.json({ error: 'Contenuto non trovato' }, { status: 404 });
  const content = { id: snap.id, ...(snap.data() as Omit<EditorialContent, 'id'>) } as EditorialContent;
  if (content.status === 'Pubblicato') return NextResponse.json({ error: 'Già pubblicato' }, { status: 409 });
  if (content.status !== 'Approvato') return NextResponse.json({ error: 'Il contenuto deve essere Approvato prima di pubblicarlo' }, { status: 409 });

  try {
    const outcomes = await runPublish([content], { dryRun: false, resetFailed: true }, Date.now());
    return NextResponse.json({ ok: true, outcomes });
  } catch (error: any) {
    console.error('[publish-now]', error);
    return NextResponse.json({ error: error?.message || 'Errore durante la pubblicazione' }, { status: 500 });
  }
}
