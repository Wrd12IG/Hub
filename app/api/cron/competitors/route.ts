import { NextRequest, NextResponse } from 'next/server';
import { denyUnlessCron } from '@/lib/cron-auth';
import { adminDb } from '@/lib/firebase-admin';
import { collectForClient } from '@/app/api/clients/[id]/competitors/route';

// Questa route legge gli header a ogni richiesta, quindi non può essere
// prerenderizzata. Senza questa riga Next.js ci prova comunque in build, il
// tentativo esplode con DYNAMIC_SERVER_USAGE e il log si riempie di stack
// trace che sembrano guasti e non lo sono. Per una route di cron il rischio è
// peggiore del rumore: una risposta messa in cache staticamente risponderebbe
// sempre la stessa cosa senza eseguire nulla.
export const dynamic = 'force-dynamic';

export const maxDuration = 300;

/**
 * Giro notturno sui competitor di tutti i clienti che ne hanno configurati.
 *
 * Il monitoraggio ha senso solo se gira da solo: un pulsante "aggiorna" dice
 * com'è il sito adesso, un giro quotidiano dice **quando è cambiato**. È la
 * differenza fra guardare una foto e accorgersi che qualcosa si è mosso.
 *
 * Protetto dallo stesso segreto delle altre cron (vedi lib/cron-auth.ts:
 * Vercel manda `Authorization: Bearer`, non un header custom).
 */
export async function GET(request: NextRequest) {
  const denied = denyUnlessCron(request, 'cron/competitors');
  if (denied) return denied;

  const started = Date.now();
  const results: { clientId: string; collected: number; changes: number; error?: string }[] = [];

  try {
    // Si guardano solo i clienti che hanno davvero dei competitor: interrogare
    // sessanta documenti per trovarne tre sarebbe uno spreco quotidiano.
    const snap = await adminDb.collectionGroup('intelligence').get();
    const clientIds = Array.from(new Set(
      snap.docs
        .filter((d) => d.id === 'competitors' && (d.data()?.competitors ?? []).length > 0)
        .map((d) => d.ref.parent.parent?.id)
        .filter(Boolean) as string[]
    ));

    for (const clientId of clientIds) {
      try {
        const r = await collectForClient(clientId);
        results.push({ clientId, collected: r.collected, changes: r.changes.length });
      } catch (err: any) {
        results.push({ clientId, collected: 0, changes: 0, error: err.message });
      }
    }

    return NextResponse.json({
      clients: results.length,
      totalChanges: results.reduce((s, r) => s + r.changes, 0),
      seconds: Math.round((Date.now() - started) / 1000),
      results,
    });
  } catch (err: any) {
    console.error('[cron/competitors] fallito:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
