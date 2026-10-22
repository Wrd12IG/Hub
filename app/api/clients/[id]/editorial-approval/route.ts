import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, denyUnlessStaff, getAppUser } from '@/lib/api-auth';
import { clientUserIds, notifyUsers } from '@/lib/server-notify';
import { canRequestApproval, requestApproval, bypassApproval, canBypassApproval } from '@/lib/content-approval';
import type { EditorialContent } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * POST /api/clients/[id]/editorial-approval  { contentIds: string[], bypass?: boolean }
 * Con bypass: approvazione interna senza cliente, solo per Amministratori o utenti con canSkipClientApproval.
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

  const bypass = body?.bypass === true;
  const appUser = bypass ? await getAppUser(user.uid) : null;
  if (bypass && !canBypassApproval(appUser as any)) return forbiddenResponse();
  const bypassName = bypass ? ((await adminDb.collection('users').doc(user.uid).get()).data()?.name as string | undefined) || 'Staff' : '';

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
      const can = canRequestApproval(bypass && c.approval?.status === 'requested' ? { ...c, approval: undefined } : c);
      if (!can.ok) return { reason: can.reason };
      // Con bypass si può chiudere anche una richiesta in attesa del cliente: è proprio il caso d'uso.
      const next = bypass ? bypassApproval(bypassName, now, user.uid) : requestApproval(user.uid, now);
      tx.update(ref, JSON.parse(JSON.stringify({ ...next, updatedAt: now })));
      return null;
    });
    if (result) skipped.push({ id, reason: result.reason }); else requested.push(id);
  }

  // Il cliente vede il PED col suo accesso: lo si avvisa che c'è qualcosa da approvare (non per il bypass interno).
  if (!bypass && requested.length > 0) {
    const first = await adminDb.collection('editorialContents').doc(requested[0]).get();
    await notifyUsers(await clientUserIds(params.id), {
      title: '📝 Contenuti da approvare',
      text: requested.length === 1 ? `C'è un contenuto da approvare nel tuo piano editoriale: "${first.data()?.topic}"` : `Ci sono ${requested.length} contenuti da approvare nel tuo piano editoriale`,
      type: 'editorial_approval_requested', category: 'editorial', priority: 'high',
      link: `/clients/${params.id}/editorial-plan`,
    });
  }

  const link = await adminDb.collection('clients').doc(params.id).collection('private').doc('publicLink').get();
  const token = link.data()?.publicToken as string | undefined;
  const origin = request.nextUrl.origin;
  return NextResponse.json({ requested, skipped, shareUrl: token ? `${origin}/share/client/${token}/approvals` : null });
}
