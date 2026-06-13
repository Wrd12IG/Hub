import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
    try {
        const { originalCaption, targetTone, topic, clientName, toneOfVoice } = await req.json();

        if (!originalCaption || !targetTone) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey || geminiApiKey === 'your_gemini_key_here') {
            return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
        }

        const model = 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

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

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: 1000,
                }
            })
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'AI Error' }, { status: 500 });
        }

        const result = await response.json();
        const rewritten = result.candidates[0].content.parts[0].text.trim();

        return NextResponse.json({ rewritten });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
