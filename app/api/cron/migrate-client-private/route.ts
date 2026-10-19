import { NextRequest, NextResponse } from 'next/server';
import { denyUnlessCron } from '@/lib/cron-auth';
import { adminDb } from '@/lib/firebase-admin';
import { migrateClientPrivate } from '@/lib/client-private-migrate';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Giro notturno: sposta piano media e dati post-lead di tutti i clienti nell'area solo-staff (clients/{id}/private) e
 * toglie i vecchi campi dal documento, ma solo dove la copia riletta è identica. Idempotente: quando non c'è più niente
 * da spostare non fa nulla. Si può togliere da vercel.json dopo la prima notte.
 */
export async function GET(request: NextRequest) {
  const denied = denyUnlessCron(request, 'migrate-client-private');
  if (denied) return denied;
  try {
    const r = await migrateClientPrivate(adminDb, { apply: true, deleteLegacy: true });
    console.log(`[cron/migrate-client-private] copiati ${r.copied}, rimossi ${r.deleted}, non verificati ${r.mismatched}`);
    return NextResponse.json({ copied: r.copied, deleted: r.deleted, mismatched: r.mismatched, log: r.log });
  } catch (e: any) {
    console.error('[cron/migrate-client-private]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
