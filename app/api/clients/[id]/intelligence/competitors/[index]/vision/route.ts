/**
 * POST /api/clients/[id]/intelligence/competitors/[index]/vision   body: { base64Image: "data:image/...;base64,..." }
 * Claude legge lo screenshot della Ads Library del competitor e ne ricava stile creativo, angoli, ganci, CTA e offerte,
 * che finiscono nella scheda del competitor. Solo staff: ogni analisi consuma crediti AI.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { loadClient, competitorsOf, saveCompetitors } from '@/lib/intelligence-store';
import { askClaudeJson, parseDataUrlImage } from '@/lib/claude';
import { buildVisionPrompt, normalizeAdAnalysis } from '@/lib/competitor-discovery';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: { id: string; index: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const image = parseDataUrlImage(String(body?.base64Image ?? ''));
  if (!image) {
    return NextResponse.json({ error: 'Immagine non valida: usa un PNG, JPEG, WebP o GIF sotto i 5 MB' }, { status: 400 });
  }

  const index = Number(params.index);
  const { ref, exists, data } = await loadClient(params.id);
  if (!exists) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });
  const list = competitorsOf(data);
  if (!Number.isInteger(index) || index < 0 || index >= list.length) {
    return NextResponse.json({ error: 'Competitor non trovato (l\'elenco è cambiato: ricarica la pagina)' }, { status: 404 });
  }

  try {
    const raw = await askClaudeJson({
      prompt: buildVisionPrompt({ competitor: String(list[index].name), client: String(data?.name ?? ''), businessType: data?.intelligence?.businessType }),
      images: [image],
      maxTokens: 1500,
      timeoutMs: 55_000,
    });
    const { summary, weakness, analysis } = normalizeAdAnalysis(raw);

    const updated = { ...list[index], adAnalysis: analysis, ...(summary ? { adStyle: summary } : {}), ...(weakness && !list[index].weakness ? { weakness } : {}) };
    await saveCompetitors(ref, list.map((c, i) => (i === index ? updated : c)), user.uid);
    return NextResponse.json({ success: true, competitor: updated });
  } catch (err: any) {
    console.error(`[competitors/vision] ${params.id}#${index}:`, err.message);
    return NextResponse.json({ error: `Analisi dello screenshot non riuscita: ${String(err.message).slice(0, 200)}` }, { status: 502 });
  }
}
