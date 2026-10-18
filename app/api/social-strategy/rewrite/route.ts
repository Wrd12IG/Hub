import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { askClaude, isClaudeConfigured } from '@/lib/claude';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessStaff(auth.uid);
  if (denied) return denied;

    try {
        const { originalCaption, targetTone, topic, clientName, toneOfVoice } = await req.json();

        if (!originalCaption || !targetTone) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        if (!isClaudeConfigured()) {
            return NextResponse.json({ error: 'ANTHROPIC_API_KEY non configurata' }, { status: 500 });
        }

        const systemPrompt = `Sei un esperto Copywriter Social Senior.
Il tuo compito è riscrivere una caption esistente mantenendo lo stesso concetto, ma cambiando il tono di voce richiesto.

Dati cliente:
- Nome: ${clientName || 'N/D'}
- Tono base: ${toneOfVoice || 'N/D'}

Contesto:
- Topic: ${topic}
- Caption originale: "${originalCaption}"

RIFORMULAZIONE RICHIESTA: Tono ${targetTone}.

Regole:
1. Mantieni lo stesso obiettivo e call to action.
2. Sii creativo ed efficace per i social.
3. Rispondi SOLO con il testo della nuova caption, senza spiegazioni o virgolette.`;

        const rewritten = (await askClaude({ prompt: systemPrompt, maxTokens: 1000, timeoutMs: 25_000 })).trim();

        return NextResponse.json({ rewritten });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
