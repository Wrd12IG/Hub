import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { normalizePexels } from '@/lib/story-editor/stock';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stories/pexels?q=…&page=1
 * Solo staff. Cerca foto verticali su Pexels (selezione del giorno se `q` è vuoto). La chiave PEXELS_API_KEY resta sul
 * server. Senza chiave risponde `configured: false`.
 */
export async function GET(request: NextRequest) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;

  const key = process.env.PEXELS_API_KEY;
  if (!key) return NextResponse.json({ configured: false, items: [], nextPage: null });

  const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 80);
  const page = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10) || 1));
  const url = new URL(q ? 'https://api.pexels.com/v1/search' : 'https://api.pexels.com/v1/curated');
  url.searchParams.set('per_page', '24');
  url.searchParams.set('page', String(page));
  if (q) { url.searchParams.set('query', q); url.searchParams.set('orientation', 'portrait'); url.searchParams.set('locale', 'it-IT'); }

  try {
    const res = await fetch(url, { headers: { Authorization: key }, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return NextResponse.json({ configured: true, error: res.status === 429 ? 'Troppe richieste a Pexels: riprova tra poco.' : 'Pexels non risponde.', items: [], nextPage: null }, { status: 502 });
    return NextResponse.json({ configured: true, ...normalizePexels(await res.json()) });
  } catch (error) {
    console.error('[stories pexels]', (error as Error)?.message);
    return NextResponse.json({ configured: true, error: 'Pexels non risponde.', items: [], nextPage: null }, { status: 502 });
  }
}
