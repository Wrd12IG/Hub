import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, denyUnlessClientAllowed, getAppUser, ownsClientResource } from '@/lib/api-auth';
import { buildClientBrief, parseClientBrief, toClientBriefItem } from '@/lib/client-brief';
import { notifyUsers } from '@/lib/server-notify';
import type { Brief } from '@/lib/data';

export const dynamic = 'force-dynamic';

/** GET: i brief di QUEL cliente, con i soli campi che il cliente deve vedere. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(user.uid, params.id);
  if (denied) return denied;
  try {
    const snap = await adminDb.collection('briefs').where('clientId', '==', params.id).get();
    const items = snap.docs
      .map((d) => toClientBriefItem({ id: d.id, ...(d.data() as Omit<Brief, 'id'>) } as Brief))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return NextResponse.json({ items });
  } catch (error) {
    console.error('[client briefs GET]', error);
    return NextResponse.json({ error: 'Errore nel caricamento' }, { status: 500 });
  }
}

/** POST { title, request, deadline?, references? }: il cliente invia una richiesta di lavorazione. Nasce "Inviato". */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const appUser = await getAppUser(user.uid);
  if (!ownsClientResource(appUser, params.id)) return forbiddenResponse();

  const parsed = parseClientBrief(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const clientSnap = await adminDb.collection('clients').doc(params.id).get();
    if (!clientSnap.exists) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });
    const client = clientSnap.data() as any;
    const doc = buildClientBrief(parsed.value, {
      clientId: params.id, clientName: client.name || '', userId: user.uid, userName: (appUser as any)?.name || 'Cliente', now: new Date(),
    });
    const ref = await adminDb.collection('briefs').add(JSON.parse(JSON.stringify(doc)));
    await notifyUsers((client.managedBy as string[]) || [], {
      title: '📝 Nuovo brief dal cliente',
      text: `${client.name} ha inviato una richiesta: "${doc.title}"`,
      type: 'brief_assigned', category: 'brief', priority: 'high',
      link: `/briefs?briefId=${ref.id}`, resourceId: ref.id, resourceType: 'brief',
    });
    return NextResponse.json({ id: ref.id }, { status: 201 });
  } catch (error) {
    console.error('[client briefs POST]', error);
    return NextResponse.json({ error: 'Errore nell\'invio' }, { status: 500 });
  }
}
