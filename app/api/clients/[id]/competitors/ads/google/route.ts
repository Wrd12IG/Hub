import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed, denyUnlessStaff } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { searchAdvertisers, type TransparencyTarget } from '@/lib/google-ads-transparency';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Una ricerca legge decine di GB di BigQuery: il risultato vale una settimana, a meno di "Aggiorna". */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * GET /api/clients/[id]/competitors/ads/google[?refresh=1]
 *
 * Annunci Google (Centro per la trasparenza pubblicitaria) degli inserzionisti italiani che corrispondono ai competitor
 * monitorati del cliente. `refresh=1` rilegge BigQuery e lo possono chiedere solo i membri dello staff.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await verifyAuth(request);
  if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(auth.uid, params.id);
  if (denied) return denied;

  const refresh = request.nextUrl.searchParams.get('refresh') === '1';
  if (refresh) {
    const notStaff = await denyUnlessStaff(auth.uid);
    if (notStaff) return notStaff;
  }

  const registry = await adminDb.collection('clients').doc(params.id).collection('intelligence').doc('competitors').get();
  const targets: TransparencyTarget[] = ((registry.data()?.competitors ?? []) as any[])
    .filter((c) => c?.id && c?.nome)
    .map((c) => ({ id: String(c.id), nome: String(c.nome), sito: c.sito ? String(c.sito) : undefined }));

  if (targets.length === 0) return NextResponse.json({ results: [], targets: 0 });

  // La voce di cache vale solo per questo elenco di competitor: se ne cambia uno, si rilegge.
  const signature = targets.map((t) => `${t.id}|${t.nome}|${t.sito ?? ''}`).sort().join(';');
  const cacheRef = adminDb.collection('clients').doc(params.id).collection('cache').doc('transparency_google');

  if (!refresh) {
    const hit = (await cacheRef.get().catch(() => null))?.data() as any;
    if (hit?.signature === signature && hit?.computedAt && Date.now() - Date.parse(hit.computedAt) < TTL_MS) {
      return NextResponse.json({ results: hit.results, computedAt: hit.computedAt, cached: true, targets: targets.length });
    }
  }

  try {
    const results = await searchAdvertisers(targets);
    const computedAt = new Date().toISOString();
    // Giro JSON: Firestore rifiuta undefined e il progetto non ha ignoreUndefinedProperties
    await cacheRef.set(JSON.parse(JSON.stringify({ signature, computedAt, results }))).catch((e) =>
      console.error('[ads/google] cache non scritta:', e.message));
    return NextResponse.json({ results, computedAt, cached: false, targets: targets.length });
  } catch (err: any) {
    console.error(`[ads/google] fallita per ${params.id}:`, err.message);
    return NextResponse.json({ error: err.message, targets: targets.length }, { status: 503 });
  }
}
