import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { collectClientMedia } from '@/lib/story-editor/stock';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stories/client-media?clientId=…
 * Solo staff. I media che il cliente ha già: la sua galleria e le immagini/video dei suoi contenuti del PED.
 */
export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;

  const clientId = (request.nextUrl.searchParams.get('clientId') || '').trim();
  if (!clientId) return NextResponse.json({ error: 'Cliente mancante' }, { status: 400 });

  try {
    const [assetsSnap, contentsSnap] = await Promise.all([
      adminDb.collection('clients').doc(clientId).collection('assets').orderBy('uploadedAt', 'desc').limit(100).get().catch(() => null),
      adminDb.collection('editorialContents').where('clientId', '==', clientId).get(),
    ]);
    const assets = assetsSnap ? assetsSnap.docs.map((d) => d.data()) : [];
    const contents = contentsSnap.docs.map((d) => d.data());
    return NextResponse.json({ items: collectClientMedia(assets, contents) });
  } catch (error) {
    console.error('[stories client-media]', error);
    return NextResponse.json({ error: 'Errore nel caricamento' }, { status: 500 });
  }
}
