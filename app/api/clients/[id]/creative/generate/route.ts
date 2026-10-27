import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { loadClientContext } from '@/lib/creative/context';
import { askClaudeJson, isClaudeConfigured } from '@/lib/claude';
import { parseCreativeRequest } from '@/lib/creative/spec';
import { buildCreativePrompt } from '@/lib/creative/playbooks';
import { finalizeItems } from '@/lib/creative/result';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/clients/[id]/creative/generate
 * Solo staff. Genera hook/script, didascalie, caroselli o riadattamenti con il metodo delle skill di marketing
 * (lib/creative/playbooks.ts), usando i dati del cliente, e controlla il risultato con regole fisse (lib/creative/result.ts).
 * Non salva nulla: il contenuto entra nel PED solo quando lo staff lo sceglie (come bozza).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = parseCreativeRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  if (!isClaudeConfigured()) {
    return NextResponse.json({ error: 'Generatore non attivo: manca ANTHROPIC_API_KEY su Vercel.' }, { status: 503 });
  }

  const loaded = await loadClientContext(params.id);
  if (!loaded) return NextResponse.json({ error: 'Cliente non trovato.' }, { status: 404 });
  const { ctx, usedProfile } = loaded;

  const { system, prompt } = buildCreativePrompt(parsed.value, ctx);
  try {
    const out = await askClaudeJson<{ items?: unknown }>({ prompt, system, maxTokens: 4000, timeoutMs: 55_000 });
    const items = finalizeItems(out?.items, parsed.value);
    if (items.length === 0) return NextResponse.json({ error: 'L\'AI non ha restituito contenuti utilizzabili: riprova.' }, { status: 502 });
    return NextResponse.json({ items, usedProfile });
  } catch (e) {
    console.error('[creative generate]', (e as Error)?.message);
    return NextResponse.json({ error: 'Generazione non riuscita: riprova tra poco.' }, { status: 502 });
  }
}
