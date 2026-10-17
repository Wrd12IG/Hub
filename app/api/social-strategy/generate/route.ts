import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { askClaudeJson, isClaudeConfigured } from '@/lib/claude';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max duration for Vercel

export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth) return unauthorizedResponse();
    const denied = await denyUnlessStaff(auth.uid);
    if (denied) return denied;

    try {
        const { prompt, systemPrompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        if (!isClaudeConfigured()) {
            return NextResponse.json({
                error: 'Impossibile generare la strategia AI al momento.',
                details: 'ANTHROPIC_API_KEY non configurata nelle variabili d\'ambiente del server.',
                env_status: { anthropic: false },
            }, { status: 500 });
        }

        try {
            const strategy = await askClaudeJson({ prompt, system: systemPrompt, maxTokens: 8000, temperature: 0.7, timeoutMs: 55_000 });
            return NextResponse.json(strategy);
        } catch (e: any) {
            console.error('Claude failed in /api/social-strategy/generate:', e.message);
            return NextResponse.json({
                error: 'Impossibile generare la strategia AI al momento.',
                details: e.message,
                env_status: { anthropic: true },
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error('CRITICAL ERROR in /api/social-strategy/generate:', error);
        return NextResponse.json({
            error: 'Errore interno del server durante la generazione.',
            details: error.message,
        }, { status: 500 });
    }
}
