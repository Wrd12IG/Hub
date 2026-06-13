/**
 * GET    /api/clients/[id]/intelligence/competitors   → Lista competitor
 * POST   /api/clients/[id]/intelligence/competitors   → Aggiungi competitor
 * DELETE /api/clients/[id]/intelligence/competitors   → Rimuovi competitor (body: {index})
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const competitorsRef = (clientId: string) =>
  adminDb.collection('clients').doc(clientId).collection('intelligence').doc('competitors');

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;

  try {
    const snap = await competitorsRef(clientId).get();
    if (!snap.exists) {
      return NextResponse.json({ competitors: [], analyses: [] });
    }
    const data = snap.data() || {};
    return NextResponse.json({
      competitors: data.list || [],
      analyses: data.analyses || [],
    });
  } catch (error) {
    console.error(`[intelligence/competitors] GET error:`, error);
    return NextResponse.json({ error: 'Failed to fetch competitors' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;

  try {
    const body = await request.json();
    const { name, url, notes } = body as { name: string; url: string; notes?: string };

    if (!name || !url) {
      return NextResponse.json({ error: 'name and url are required' }, { status: 400 });
    }

    const competitor = {
      name,
      url,
      notes: notes || '',
      addedAt: new Date().toISOString(),
      addedBy: user.uid,
    };

    await competitorsRef(clientId).set(
      { list: FieldValue.arrayUnion(competitor) },
      { merge: true }
    );

    return NextResponse.json({ success: true, competitor }, { status: 201 });
  } catch (error) {
    console.error(`[intelligence/competitors] POST error:`, error);
    return NextResponse.json({ error: 'Failed to add competitor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;

  try {
    const body = await request.json();
    const { competitor } = body as { competitor: object };

    await competitorsRef(clientId).update({
      list: FieldValue.arrayRemove(competitor),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(`[intelligence/competitors] DELETE error:`, error);
    return NextResponse.json({ error: 'Failed to remove competitor' }, { status: 500 });
  }
}
