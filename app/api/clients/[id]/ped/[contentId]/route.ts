import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, ownsClientResource } from '@/lib/api-auth';
import { applyDecision, parseDecision } from '@/lib/content-approval';
import { notifyUsers } from '@/lib/server-notify';
import type { EditorialContent } from '@/lib/data';

export const dynamic = 'force-dynamic';

/**
 * POST /api/clients/[id]/ped/[contentId]  { decision: 'approve' | 'changes', comment? }
 * Il cliente approva o chiede modifiche. Solo un utente Cliente di QUEL cliente: lo staff non risponde al posto suo
 * (per approvare senza cliente c'è "Approva senza cliente", riservato agli amministratori e tracciato).
 * Risponde solo a un contenuto in attesa, in transazione: niente doppia risposta, niente auto-approvazione.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string; contentId: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const appUser = await getAppUser(user.uid);
  if (!ownsClientResource(appUser, params.id)) return forbiddenResponse();

  const body = await request.json().catch(() => null);
  const parsed = parseDecision({ ...body, name: (appUser as any)?.name || body?.name });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const ref = adminDb.collection('editorialContents').doc(params.contentId);
  const now = new Date();
  try {
    const outcome = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || snap.data()?.clientId !== params.id) return 'notfound' as const;
      const next = applyDecision(snap.data() as Pick<EditorialContent, 'approval'>, parsed.value, now);
      if (!next) return 'closed' as const;
      tx.update(ref, JSON.parse(JSON.stringify({ ...next, updatedAt: now })));
      return 'ok' as const;
    });
    if (outcome === 'notfound') return NextResponse.json({ error: 'Contenuto non trovato' }, { status: 404 });
    if (outcome === 'closed') return NextResponse.json({ error: 'Questo contenuto non è più in attesa di risposta' }, { status: 409 });

    // Avviso a chi ha chiesto l'approvazione e ai responsabili del cliente
    const [content, client] = await Promise.all([ref.get(), adminDb.collection('clients').doc(params.id).get()]);
    const c = content.data() as EditorialContent | undefined;
    const recipients = new Set<string>([...(c?.approval?.requestedBy ? [c.approval.requestedBy] : []), ...(((client.data() as any)?.managedBy as string[]) || [])]);
    const approved = parsed.value.decision === 'approve';
    await notifyUsers(recipients, {
      title: '💬 Il cliente ha risposto',
      text: approved ? `${(client.data() as any)?.name} ha approvato "${c?.topic}"` : `${(client.data() as any)?.name} chiede modifiche a "${c?.topic}"`,
      type: 'editorial_client_response', category: 'editorial', priority: 'high',
      link: `/clients/${params.id}/editorial-plan`, resourceId: params.contentId, resourceType: 'editorial_content',
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ped decision]', error);
    return NextResponse.json({ error: 'Errore' }, { status: 500 });
  }
}
