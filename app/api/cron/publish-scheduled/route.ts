import { NextRequest, NextResponse } from 'next/server';
import { denyUnlessCron } from '@/lib/cron-auth';
import { adminDb } from '@/lib/firebase-admin';
import { isDue, dueState } from '@/lib/publisher';
import { runPublish, type Outcome } from '@/lib/publish-runner';
import type { EditorialContent } from '@/lib/data';

// Come le altre cron: legge gli header a ogni richiesta, quindi mai prerenderizzata.
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Pubblica i contenuti "Approvato" la cui data è arrivata (logica e protezioni in lib/publish-runner.ts).
 *
 * ⚠️ Pubblica DAVVERO sui profili dei clienti, quindi è spenta finché non si imposta EDITORIAL_AUTOPUBLISH=1 su Vercel.
 * `?dryRun=1` mostra cosa uscirebbe senza scrivere né chiamare nulla (funziona anche a cron spenta).
 */
export async function GET(request: NextRequest) {
  const denied = denyUnlessCron(request, 'cron/publish-scheduled');
  if (denied) return denied;

  const dryRun = request.nextUrl.searchParams.get('dryRun') === '1';
  if (!dryRun && process.env.EDITORIAL_AUTOPUBLISH !== '1') {
    return NextResponse.json({ ok: true, disabled: true, hint: 'Imposta EDITORIAL_AUTOPUBLISH=1 per attivare la pubblicazione.' });
  }

  const started = Date.now();
  const now = new Date();
  let outcomes: Outcome[] = [];

  try {
    const snap = await adminDb.collection('editorialContents').where('status', '==', 'Approvato').get();
    const approved = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EditorialContent, 'id'>) }) as EditorialContent);
    // Arretrato: approvati con data scaduta da troppo. Si elencano (così si vedono) ma non si pubblicano.
    const skippedLate = approved.filter((c) => dueState(c, now) === 'too-late').map((c) => ({ contentId: c.id, topic: c.topic, clientId: c.clientId, publicationDate: c.publicationDate }));
    const due = approved
      .filter((c) => isDue(c, now))
      .sort((a, b) => String(a.publicationDate).localeCompare(String(b.publicationDate)));

    outcomes = await runPublish(due, { dryRun }, started);
    return NextResponse.json({ ok: true, dryRun, due: due.length, skippedTooLate: skippedLate, outcomes, elapsedMs: Date.now() - started });
  } catch (error: any) {
    console.error('[cron/publish-scheduled]', error);
    return NextResponse.json({ ok: false, error: error?.message || 'Errore', outcomes }, { status: 500 });
  }
}
