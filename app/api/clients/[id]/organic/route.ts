/**
 * GET  /api/clients/[id]/organic?month=YYYY-MM
 *   → Array<OrganicPost> per il mese specificato
 *
 * POST /api/clients/[id]/organic
 *   → Crea nuovo post nel piano editoriale organico (Firestore)
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const COLLECTION = 'organicPosts';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;
  const month = request.nextUrl.searchParams.get('month'); // es. "2026-06"

  try {
    let query = adminDb
      .collection(COLLECTION)
      .where('clientId', '==', clientId);

    // Filtra per mese se specificato
    if (month) {
      const [y, m] = month.split('-').map(Number);
      const startDate = new Date(y, m - 1, 1).toISOString();
      const endDate   = new Date(y, m, 1).toISOString();
      query = query
        .where('publishAt', '>=', startDate)
        .where('publishAt', '<',  endDate);
    }

    const snap = await query.orderBy('publishAt', 'asc').get();
    const posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json(posts);
  } catch (error: any) {
    console.error('[organic GET]', error);
    return NextResponse.json(
      { error: 'Errore nel caricamento dei post', detail: error?.message },
      { status: 500 }
    );
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
    const {
      title, caption, content, platform, platforms, postType,
      status, publishAt, mediaUrls, hashtags, linkUrl, metadata,
    } = body;

    const doc = {
      clientId,
      title:       title       || '',
      caption:     caption     || null,
      content:     content     || null,
      platform:    platform    || (Array.isArray(platforms) ? platforms[0] : 'INSTAGRAM'),
      platforms:   Array.isArray(platforms) ? platforms : (platform ? [platform] : ['INSTAGRAM']),
      postType:    postType    || 'PHOTO',
      status:      status      || 'DRAFT',
      publishAt:   publishAt   || null,
      mediaUrls:   Array.isArray(mediaUrls) ? mediaUrls : [],
      hashtags:    Array.isArray(hashtags)  ? hashtags  : [],
      linkUrl:     linkUrl     || null,
      metadata:    metadata    || null,
      metaPostId:  null,
      metaPostUrl: null,
      publishError: null,
      externalSource: null,
      importedAt:  null,
      createdBy:   user.uid || null,
      createdAt:   FieldValue.serverTimestamp(),
      updatedAt:   FieldValue.serverTimestamp(),
    };

    const ref = await adminDb.collection(COLLECTION).add(doc);

    return NextResponse.json({ id: ref.id, ...doc }, { status: 201 });
  } catch (error: any) {
    console.error('[organic POST]', error);
    return NextResponse.json(
      { error: 'Errore nella creazione del post', detail: error?.message },
      { status: 500 }
    );
  }
}
