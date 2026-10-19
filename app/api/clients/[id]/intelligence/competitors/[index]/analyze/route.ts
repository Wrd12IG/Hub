/**
 * POST /api/clients/[id]/intelligence/competitors/[index]/analyze
 * Claude cerca sul web (sito, recensioni, social) e scrive punti di forza e DEBOLI del competitor con le fonti.
 * Non inventa: se non trova lacune verificabili lascia il campo vuoto e lo dice. Non sovrascrive ciò che è scritto a mano.
 * Solo staff: ogni analisi consuma crediti AI.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { loadClient, competitorsOf, saveCompetitors } from '@/lib/intelligence-store';
import { askClaudeJson } from '@/lib/claude';
import { buildAnalysisPrompt, normalizeAnalysis } from '@/lib/competitor-discovery';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: { id: string; index: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;

  const index = Number(params.index);
  const { ref, exists, data } = await loadClient(params.id);
  if (!exists) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });
  const list = competitorsOf(data);
  if (!Number.isInteger(index) || index < 0 || index >= list.length) {
    return NextResponse.json({ error: 'Competitor non trovato (l\'elenco è cambiato: ricarica la pagina)' }, { status: 404 });
  }
  const c = list[index];

  const intel = data?.intelligence ?? {};
  const territory = [...(intel.territoryCities ?? []), ...(intel.territoryRegions ?? [])].filter(Boolean).join(', ') || data?.city || '';
  const prompt = buildAnalysisPrompt({
    competitor: String(c.name), url: String(c.url ?? ''), city: c.city, kind: c.kind,
    client: String(data?.name ?? ''), businessType: intel.businessType || data?.industry, territory,
  });

  try {
    let webSearch = true;
    let raw: any;
    try {
      raw = await askClaudeJson({ prompt, webSearch: { maxUses: 5 }, maxTokens: 3000, timeoutMs: 55_000 });
    } catch (e: any) {
      // Senza ricerca web non ci sono fonti da citare: meglio dirlo che produrre un giudizio a memoria.
      console.warn('[competitors/analyze] ricerca web non riuscita:', String(e.message).slice(0, 200));
      return NextResponse.json({ error: `La ricerca web non è riuscita (${String(e.message).slice(0, 140)}). Riprova tra poco.` }, { status: 502 });
    }
    const a = normalizeAnalysis(raw);

    const updated = {
      ...c,
      ...(a.weakness && !c.weakness ? { weakness: a.weakness } : {}),
      ...(a.strength && !c.strength ? { strength: a.strength } : {}),
      weaknessSources: a.sources,
      analysisNote: a.weakness ? '' : (a.note || 'Nessuna lacuna verificabile dalle fonti trovate.'),
      analyzedAt: Date.now(),
    };
    await saveCompetitors(ref, list.map((x, i) => (i === index ? updated : x)), user.uid);
    return NextResponse.json({ success: true, competitor: updated, webSearch });
  } catch (err: any) {
    console.error(`[competitors/analyze] ${params.id}#${index}:`, err.message);
    return NextResponse.json({ error: `Analisi non riuscita: ${String(err.message).slice(0, 200)}` }, { status: 502 });
  }
}
