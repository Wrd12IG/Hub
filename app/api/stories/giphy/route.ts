import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { normalizeGiphy } from '@/lib/story-editor/stock';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stories/giphy?q=…&offset=0
 * Solo staff. Cerca GIF su Giphy (in tendenza se `q` è vuoto). La chiave GIPHY_API_KEY resta sul server: al browser
 * arrivano solo i risultati ridotti (lib/story-editor/stock.ts). Senza chiave risponde `configured: false`.
 */
export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;

  const key = process.env.GIPHY_API_KEY;
  if (!key) return NextResponse.json({ configured: false, items: [], nextOffset: null });

  const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 80);
  const offset = Math.max(0, parseInt(request.nextUrl.searchParams.get('offset') || '0', 10) || 0);
  const url = new URL(`https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('limit', '24');
  url.searchParams.set('offset', String(Math.min(offset, 4000)));
  url.searchParams.set('rating', 'pg');
  url.searchParams.set('lang', 'it');
  if (q) url.searchParams.set('q', q);

  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return NextResponse.json({ configured: true, error: res.status === 429 ? 'Troppe richieste a Giphy: riprova tra poco.' : 'Giphy non risponde.', items: [], nextOffset: null }, { status: 502 });
    return NextResponse.json({ configured: true, ...normalizeGiphy(await res.json()) });
  } catch (error) {
    console.error('[stories giphy]', (error as Error)?.message);
    return NextResponse.json({ configured: true, error: 'Giphy non risponde.', items: [], nextOffset: null }, { status: 502 });
  }
}
