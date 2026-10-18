/**
 * GET  /api/clients/[id]/intelligence/competitors → elenco dei competitor della scheda AI Intelligence
 * POST /api/clients/[id]/intelligence/competitors → aggiunge un competitor { name, url? } (solo staff)
 * Eliminazione: DELETE .../competitors/[index]. Ricerca automatica: POST .../competitors/discover.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed, denyUnlessStaff } from '@/lib/api-auth';
import { loadClient, competitorsOf, saveCompetitors } from '@/lib/intelligence-store';
import { assertPublicHttpUrl } from '@/lib/site-intelligence';
import type { SavedCompetitor } from '@/lib/competitor-discovery';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessClientAllowed(user.uid, params.id);
  if (denied) return denied;

  const { exists, data } = await loadClient(params.id);
  if (!exists) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });
  return NextResponse.json({ competitors: competitorsOf(data) });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name ?? '').trim().slice(0, 80);
  const rawUrl = String(body?.url ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Scrivi il nome del competitor' }, { status: 400 });

  // Il sito è facoltativo (la scheda chiede solo il nome), ma se c'è deve essere pubblico: il Hub lo leggerà dal server
  let url = '';
  if (rawUrl) {
    try { url = assertPublicHttpUrl(rawUrl).href; }
    catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
  }

  const { ref, exists, data } = await loadClient(params.id);
  if (!exists) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });

  const competitor: SavedCompetitor = { name, url, addedAt: Date.now(), addedBy: user.uid };
  const list = [...competitorsOf(data), competitor];
  await saveCompetitors(ref, list, user.uid);
  return NextResponse.json({ success: true, competitor, competitors: list }, { status: 201 });
}
