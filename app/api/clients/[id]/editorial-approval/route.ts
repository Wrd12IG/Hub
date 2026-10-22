import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { canRequestApproval, requestApproval } from '@/lib/content-approval';
import type { EditorialContent } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * POST /api/clients/[id]/editorial-approval  { contentIds: string[] }
 * Solo staff. Mette i contenuti "In Approvazione Cliente" e restituisce il link pubblico dove il cliente risponde
 * (shareUrl = null se il cliente non ha ancora un link: va generato dalla scheda cliente).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.contentIds) ? body.contentIds.filter((x: unknown) => typeof x === 'string').slice(0, 100) : [];
  if (ids.length === 0) return NextResponse.json({ error: 'Nessun contenuto indicato' }, { status: 400 });

  const now = new Date();
  const requested: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const id of ids) {
    const ref = adminDb.collection('editorialContents').doc(id);
    // In transazione: due clic ravvicinati non devono ripartire da zero una richiesta già inviata.
    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { reason: 'non trovato' };
      const c = { id, ...(snap.data() as Omit<EditorialContent, 'id'>) } as EditorialContent;
      if (c.clientId !== params.id) return { reason: 'non appartiene a questo cliente' };
      const can = canRequestApproval(c);
      if (!can.ok) return { reason: can.reason };
      const next = requestApproval(user.uid, now);
      tx.update(ref, JSON.parse(JSON.stringify({ ...next, updatedAt: now })));
      return null;
    });
    if (result) skipped.push({ id, reason: result.reason }); else requested.push(id);
  }

  const link = await adminDb.collection('clients').doc(params.id).collection('private').doc('publicLink').get();
  const token = link.data()?.publicToken as string | undefined;
  const origin = request.nextUrl.origin;
  return NextResponse.json({ requested, skipped, shareUrl: token ? `${origin}/share/client/${token}/approvals` : null });
}
