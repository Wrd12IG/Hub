import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { isProxyable } from '@/lib/story-editor/proxy';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * GET /api/stories/media-proxy?url=…
 * Solo staff. Restituisce un'immagine o un video esterno dal dominio del Hub, per l'editor delle storie: la politica di
 * sicurezza non lascia caricare direttamente Giphy e Pexels, e una tela con immagini di altri domini non si può esportare.
 *
 * Protezioni: solo https, solo i domini elencati in lib/story-editor/proxy.ts (niente richieste verso indirizzi interni),
 * nessun reindirizzamento seguito, solo tipi immagine/video, tetto di 25 MB.
 */
export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;

  const target = request.nextUrl.searchParams.get('url') || '';
  if (!isProxyable(target)) return NextResponse.json({ error: 'Indirizzo non consentito' }, { status: 400 });

  try {
    const upstream = await fetch(target, { redirect: 'manual', cache: 'no-store' });
    if (!upstream.ok || !upstream.body) return NextResponse.json({ error: 'Media non disponibile' }, { status: 502 });
    const type = upstream.headers.get('content-type') || '';
    if (!/^(image|video)\//i.test(type)) return NextResponse.json({ error: 'Tipo di file non consentito' }, { status: 415 });
    const length = Number(upstream.headers.get('content-length') || 0);
    if (length > MAX_BYTES) return NextResponse.json({ error: 'File troppo grande' }, { status: 413 });

    const buf = await upstream.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return NextResponse.json({ error: 'File troppo grande' }, { status: 413 });
    return new NextResponse(buf, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600' } });
  } catch (error) {
    console.error('[stories media-proxy]', error);
    return NextResponse.json({ error: 'Errore nel recupero del media' }, { status: 502 });
  }
}
