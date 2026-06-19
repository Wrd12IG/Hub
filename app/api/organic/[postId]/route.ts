/**
 * PATCH  /api/organic/[postId]  — Aggiorna un post del piano editoriale
 * DELETE /api/organic/[postId]  — Elimina un post del piano editoriale
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const COLLECTION = 'organicPosts';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { postId } = params;

  try {
    const body = await request.json();

    // Campi aggiornabili
    const allowed = [
      'title', 'caption', 'content', 'platform', 'platforms',
      'postType', 'status', 'publishAt', 'mediaUrls', 'hashtags',
      'linkUrl', 'metadata', 'metaPostId', 'metaPostUrl', 'publishError',
    ];

    const updates: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }

    const docRef = adminDb.collection(COLLECTION).doc(postId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Post non trovato' }, { status: 404 });
    }

    await docRef.update(updates);

    return NextResponse.json({ id: postId, ...snap.data(), ...updates });
  } catch (error: any) {
    console.error('[organic PATCH]', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento', detail: error?.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { postId: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { postId } = params;

  try {
    const docRef = adminDb.collection(COLLECTION).doc(postId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'Post non trovato' }, { status: 404 });
    }

    await docRef.delete();
    return NextResponse.json({ success: true, id: postId });
  } catch (error: any) {
    console.error('[organic DELETE]', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione', detail: error?.message },
      { status: 500 }
    );
  }
}
