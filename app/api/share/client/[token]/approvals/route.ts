import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { findClientByPublicToken } from '@/lib/client-public-link';
import { applyDecision, parseDecision, toPublicContent } from '@/lib/content-approval';
import type { EditorialContent } from '@/lib/data';

export const dynamic = 'force-dynamic';

// Nessun login: l'unica credenziale è il token del link. Ogni esito negativo risponde allo stesso modo.
const notFound = () => NextResponse.json({ error: 'Not found' }, { status: 404 });

/**
 * Avvisa chi ha chiesto l'approvazione e i responsabili del cliente (notifica in-app). Un errore qui non deve far
 * fallire la risposta del cliente, che è già stata salvata.
 */
async function notifyStaff(client: { id: string; data: Record<string, any> }, contentId: string, approved: boolean, now: Date) {
  try {
    const snap = await adminDb.collection('editorialContents').doc(contentId).get();
    const c = snap.data() as EditorialContent | undefined;
    if (!c) return;
    const recipients = new Set<string>([...(c.approval?.requestedBy ? [c.approval.requestedBy] : []), ...((client.data.managedBy as string[]) || [])]);
    await Promise.all(Array.from(recipients).map((userId) => adminDb.collection('users').doc(userId).collection('notifications').add({
      userId,
      title: '💬 Il cliente ha risposto',
      text: approved ? `${client.data.name} ha approvato "${c.topic}"` : `${client.data.name} chiede modifiche a "${c.topic}"`,
      type: 'editorial_client_response',
      category: 'editorial',
      priority: 'high',
      isRead: false,
      timestamp: now.toISOString(),
      link: `/clients/${client.id}/editorial-plan`,
      resourceId: contentId,
      resourceType: 'editorial_content',
    })));
  } catch (error) {
    console.error('[share approvals notify]', error);
  }
}

/** I contenuti del cliente che attendono la sua risposta, con i soli campi che il cliente deve vedere. */
export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const client = await findClientByPublicToken(adminDb, params.token);
    if (!client) return notFound();
    const snap = await adminDb.collection('editorialContents').where('clientId', '==', client.id).where('approval.status', '==', 'requested').get();
    const items = snap.docs
      .map((d) => toPublicContent({ id: d.id, ...(d.data() as Omit<EditorialContent, 'id'>) } as EditorialContent))
      .sort((a, b) => String(a.publicationDate).localeCompare(String(b.publicationDate)));
    return NextResponse.json({ clientName: client.data.name || '', items });
  } catch (error) {
    console.error('[share approvals GET]', error);
    return NextResponse.json({ error: 'Errore' }, { status: 500 });
  }
}

/** Risposta del cliente: { contentId, decision: 'approve' | 'changes', comment?, name? }. */
export async function POST(request: Request, { params }: { params: { token: string } }) {
  try {
    const client = await findClientByPublicToken(adminDb, params.token);
    if (!client) return notFound();
    const body = await request.json().catch(() => null);
    const contentId = typeof body?.contentId === 'string' ? body.contentId : '';
    if (!contentId) return NextResponse.json({ error: 'Contenuto mancante' }, { status: 400 });
    const parsed = parseDecision(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const ref = adminDb.collection('editorialContents').doc(contentId);
    const now = new Date();
    const outcome = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      // Un contenuto di un altro cliente è "non trovato", non "vietato": il link non deve rivelare che esiste.
      if (!snap.exists || snap.data()?.clientId !== client.id) return 'notfound' as const;
      const next = applyDecision(snap.data() as Pick<EditorialContent, 'approval'>, parsed.value, now);
      if (!next) return 'closed' as const;
      tx.update(ref, JSON.parse(JSON.stringify({ ...next, updatedAt: now })));
      return 'ok' as const;
    });
    if (outcome === 'notfound') return notFound();
    if (outcome === 'closed') return NextResponse.json({ error: 'Questo contenuto non è più in attesa di risposta' }, { status: 409 });
    await notifyStaff(client, contentId, parsed.value.decision === 'approve', now);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[share approvals POST]', error);
    return NextResponse.json({ error: 'Errore' }, { status: 500 });
  }
}
