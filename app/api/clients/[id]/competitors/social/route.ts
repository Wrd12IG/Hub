import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed, denyUnlessStaff } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { readCompetitorSocial, type SocialTarget, type MetaAccess } from '@/lib/competitor-social';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** I numeri dei social cambiano lentamente: mezza giornata, a meno di "Leggi ora". */
const TTL_MS = 12 * 60 * 60 * 1000;

/**
 * GET /api/clients/[id]/competitors/social[?refresh=1]
 *
 * Dati pubblici dei profili social salvati per i competitor (vedi lib/competitor-social.ts per cosa si legge e cosa no).
 * `refresh=1` rilegge e lo possono chiedere solo i membri dello staff.
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
  const targets: SocialTarget[] = ((registry.data()?.competitors ?? []) as any[])
    .filter((c) => c?.id && (c.instagram || c.facebook || c.linkedin || c.youtube || c.tiktok))
    .map((c) => ({ id: String(c.id), instagram: c.instagram, facebook: c.facebook, linkedin: c.linkedin, youtube: c.youtube, tiktok: c.tiktok }));

  if (targets.length === 0) return NextResponse.json({ results: [] });

  // Per leggere Instagram servono il token di sistema e l'account Instagram collegato del cliente (lo stesso della Overview)
  const clientDoc = await adminDb.collection('clients').doc(params.id).get();
  const token = process.env.META_SYSTEM_USER_TOKEN || process.env.META_ACCESS_TOKEN;
  const igId = (clientDoc.data() as any)?.windsorAccounts?.instagram;
  const meta: MetaAccess | undefined = token ? { token, instagramUserId: igId ? String(igId) : undefined } : undefined;

  // L'accesso a Meta entra nella firma: configurarlo invalida la cache che diceva «non leggibile»
  const signature = `meta:${!!meta}:${!!meta?.instagramUserId}|` + targets.map((t) => [t.id, t.instagram, t.facebook, t.linkedin, t.youtube, t.tiktok].join('|')).sort().join(';');
  const cacheRef = adminDb.collection('clients').doc(params.id).collection('cache').doc('competitor_social');

  if (!refresh) {
    const hit = (await cacheRef.get().catch(() => null))?.data() as any;
    if (hit?.signature === signature && hit?.computedAt && Date.now() - Date.parse(hit.computedAt) < TTL_MS) {
      return NextResponse.json({ results: hit.results, computedAt: hit.computedAt, cached: true });
    }
  }

  try {
    const results = await readCompetitorSocial(targets, meta);
    const computedAt = new Date().toISOString();
    // Giro JSON: Firestore rifiuta undefined e il progetto non ha ignoreUndefinedProperties
    await cacheRef.set(JSON.parse(JSON.stringify({ signature, computedAt, results }))).catch((e) =>
      console.error('[competitors/social] cache non scritta:', e.message));
    return NextResponse.json({ results, computedAt, cached: false });
  } catch (err: any) {
    console.error(`[competitors/social] fallita per ${params.id}:`, err.message);
    return NextResponse.json({ error: err.message }, { status: 503 });
  }
}
