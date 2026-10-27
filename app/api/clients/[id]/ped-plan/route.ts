import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { askClaudeJson, isClaudeConfigured } from '@/lib/claude';
import { loadClientContext } from '@/lib/creative/context';
import { buildDetailPrompt, buildSkeletonPrompt } from '@/lib/ped-plan/playbook';
import { normalizeDetail, normalizeSkeleton, parsePlanRequest, type SkeletonPost } from '@/lib/ped-plan/spec';
import { auditPlan, auditPost, hookScore } from '@/lib/ped-plan/checks';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/clients/[id]/ped-plan — solo staff. Il piano nasce in due tempi, chiamati dal browser uno dopo l'altro
 * (un mese intero in una sola chiamata supererebbe i 60 s della funzione):
 *   { stage: 'skeleton', period, startDate, goal, events, facts }   → { posts: SkeletonPost[], warnings }
 *   { stage: 'detail', post: SkeletonPost, goal, events, facts }     → { post: PlanPost }
 * Non salva nulla: il piano entra nel PED, come bozza, solo quando lo staff lo conferma.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();
  const denied = await denyUnlessStaff(user.uid);
  if (denied) return denied;
  if (!isClaudeConfigured()) return NextResponse.json({ error: 'Generatore non attivo: manca ANTHROPIC_API_KEY su Vercel.' }, { status: 503 });

  const body = await request.json().catch(() => null);
  const loaded = await loadClientContext(params.id);
  if (!loaded) return NextResponse.json({ error: 'Cliente non trovato.' }, { status: 404 });

  if (body?.stage === 'skeleton') {
    const parsed = parsePlanRequest(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { system, prompt } = buildSkeletonPrompt(parsed.value, loaded.ctx);
    try {
      const out = await askClaudeJson<{ posts?: unknown }>({ prompt, system, maxTokens: 4000, timeoutMs: 55_000 });
      const posts = normalizeSkeleton(out?.posts, parsed.value);
      if (posts.length === 0) return NextResponse.json({ error: 'L\'AI non ha restituito un piano utilizzabile: riprova.' }, { status: 502 });
      return NextResponse.json({ posts, warnings: auditPlan(posts), usedProfile: loaded.usedProfile });
    } catch (e) {
      console.error('[ped-plan skeleton]', (e as Error)?.message);
      return NextResponse.json({ error: 'Generazione del piano non riuscita: riprova tra poco.' }, { status: 502 });
    }
  }

  if (body?.stage === 'detail') {
    const parsed = parsePlanRequest({ period: 'week', startDate: '2000-01-01', goal: body.goal, events: body.events, facts: body.facts });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const base = normalizeSkeleton([body.post], { ...parsed.value, period: 'month', startDate: String(body.post?.date || '') })[0] as SkeletonPost | undefined;
    if (!base) return NextResponse.json({ error: 'Contenuto del piano non valido.' }, { status: 400 });
    const { system, prompt } = buildDetailPrompt(base, parsed.value, loaded.ctx);
    try {
      const out = await askClaudeJson<unknown>({ prompt, system, maxTokens: 4000, timeoutMs: 55_000 });
      const post = normalizeDetail(out, { ...base, id: String(body.post?.id || base.id) });
      if (!post) return NextResponse.json({ error: 'L\'AI non ha restituito il contenuto: riprova.' }, { status: 502 });
      // Controlli fissi: punteggio degli agganci e avvisi
      if (post.format === 'Reel' || post.hook.spoken) {
        post.hookScore = hookScore(post.hook.spoken).score;
        post.hook.alternatives = post.hook.alternatives.map((a) => ({ ...a, score: hookScore(a.spoken).score }));
      }
      post.warnings = auditPost(post, `${parsed.value.facts}\n${parsed.value.events}\n${post.theme}\n${post.angle}`);
      const best = post.hook.alternatives.find((a) => (a.score ?? 0) >= (post.hookScore ?? 0) + 10);
      if (best) post.warnings.push(`Un aggancio alternativo ha un punteggio più alto (${best.score} contro ${post.hookScore}): valuta di scambiarlo.`);
      const hs = post.format === 'Reel' ? hookScore(post.hook.spoken) : null;
      if (hs && hs.score < 50) post.warnings.push(`Aggancio debole (punteggio ${hs.score}/100): ${hs.notes.join(' ')}`);
      return NextResponse.json({ post });
    } catch (e) {
      console.error('[ped-plan detail]', (e as Error)?.message);
      return NextResponse.json({ error: 'Generazione del contenuto non riuscita: riprova.' }, { status: 502 });
    }
  }

  return NextResponse.json({ error: 'Richiesta non valida.' }, { status: 400 });
}
