/**
 * POST /api/clients/[id]/intelligence/competitors/discover
 * Claude cerca sul web i concorrenti diretti del cliente; il Hub verifica che ogni sito esista e risponda e li salva
 * nella scheda AI Intelligence (togliendo le voci generiche senza sito). Solo staff.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { loadClient, competitorsOf, saveCompetitors } from '@/lib/intelligence-store';
import { askClaudeJson } from '@/lib/claude';
import { buildDiscoveryPrompt, normalizeCandidates, verifyCandidates, mergeDiscovered } from '@/lib/competitor-discovery';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;

  const { ref, exists, data } = await loadClient(params.id);
  if (!exists) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });

  const intel = data?.intelligence ?? {};
  const territory = [...(intel.territoryCities ?? []), ...(intel.territoryRegions ?? [])].filter(Boolean).join(', ')
    || data?.city || data?.address || '';
  const prompt = buildDiscoveryPrompt({
    name: String(data?.name ?? ''), websiteUrl: data?.websiteUrl, businessType: intel.businessType || data?.industry,
    territory, product: intel.productDescription,
  });

  try {
    // 1. Con ricerca web. Se Anthropic non la concede (non abilitata sull'account, parametro rifiutato) si ripiega sulla
    //    sola conoscenza del modello: i siti vengono comunque verificati dal Hub, ma conviene ricontrollare i nomi.
    let source: 'claude-web' | 'claude' = 'claude-web';
    let raw: any;
    try {
      raw = await askClaudeJson({ prompt, webSearch: { maxUses: 6 }, maxTokens: 4000, timeoutMs: 55_000 });
    } catch (e: any) {
      console.warn('[competitors/discover] ricerca web non disponibile, ripiego senza:', String(e.message).slice(0, 200));
      source = 'claude';
      raw = await askClaudeJson({ prompt, maxTokens: 3000, timeoutMs: 45_000 });
    }

    const candidates = normalizeCandidates(raw);
    const { verified, rejected } = await verifyCandidates(candidates, {
      ownDomains: [String(data?.websiteUrl ?? '')].filter(Boolean), source, max: 6,
    });

    const merged = mergeDiscovered(competitorsOf(data), verified);
    if (merged.added > 0 || merged.removed > 0 || merged.updated > 0) await saveCompetitors(ref, merged.list, user.uid);

    return NextResponse.json({
      success: true,
      source,
      candidates: candidates.length,
      added: merged.added,
      removed: merged.removed,
      updated: merged.updated,
      rejected,
      competitors: merged.list,
      ...(verified.length === 0 ? { warning: 'Nessun sito verificato: i candidati proposti non sono raggiungibili o sono portali' } : {}),
    });
  } catch (err: any) {
    console.error(`[competitors/discover] ${params.id}:`, err.message);
    return NextResponse.json({ error: `Ricerca competitor non riuscita: ${String(err.message).slice(0, 200)}` }, { status: 502 });
  }
}
