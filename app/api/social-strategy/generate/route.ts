import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max duration for Vercel

const GEMINI_MODELS = [
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
];

export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req);
    if (!auth) return unauthorizedResponse();

    try {
        const { prompt, systemPrompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const geminiApiKey = process.env.GEMINI_API_KEY;
        const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

        const isGeminiValid = geminiApiKey && geminiApiKey !== 'your_gemini_key_here';
        const isAnthropicValid = anthropicApiKey && anthropicApiKey !== 'your_api_key_here';

        // ── 1. Try Gemini API models with fallback ──
        if (isGeminiValid) {
            let lastError: any = null;

            for (const model of GEMINI_MODELS) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            system_instruction: {
                                parts: [{ text: systemPrompt }]
                            },
                            contents: [{
                                parts: [{ text: prompt }]
                            }],
                            generationConfig: {
                                temperature: 0.7,
                                maxOutputTokens: 8192,
                                responseMimeType: "application/json",
                            }
                        })
                    });

                    if (!response.ok) {
                        const errorBody = await response.json().catch(() => ({}));
                        console.warn(`Gemini model ${model} failed:`, response.status, errorBody);
                        lastError = errorBody.error?.message || response.statusText;
                        continue; // try next model
                    }

                    const result = await response.json();

                    if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
                        console.warn(`Gemini model ${model} returned empty candidates`);
                        lastError = 'No candidate content found';
                        continue;
                    }

                    let content = result.candidates[0].content.parts[0].text;

                    // Clean codeblock markers if present
                    content = content.replace(/```json/g, '').replace(/```/g, '').trim();

                    const startIdx = content.indexOf('{');
                    const endIdx = content.lastIndexOf('}');

                    if (startIdx === -1 || endIdx === -1) {
                        throw new Error('No JSON structure found in AI response');
                    }

                    const jsonStr = content.substring(startIdx, endIdx + 1);
                    const parsed = JSON.parse(jsonStr);

                    return NextResponse.json(parsed);
                } catch (err: any) {
                    console.error(`Error with Gemini model ${model}:`, err.message);
                    lastError = err.message;
                }
            }

            console.error('All Gemini models failed, checking Anthropic fallback...', lastError);
        }

        // ── 2. Fallback to Anthropic Claude ──
        if (isAnthropicValid) {
            try {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': anthropicApiKey as string,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-5-sonnet-20241022',
                        max_tokens: 4000,
                        system: systemPrompt,
                        messages: [
                            { role: 'user', content: prompt }
                        ]
                    })
                });

                if (response.ok) {
                    const result = await response.json();
                    let content = result.content[0].text;
                    content = content.replace(/```json/g, '').replace(/```/g, '').trim();

                    const startIdx = content.indexOf('{');
                    const endIdx = content.lastIndexOf('}');
                    const jsonStr = content.substring(startIdx, endIdx + 1);
                    return NextResponse.json(JSON.parse(jsonStr));
                }
            } catch (e: any) {
                console.error('Anthropic API failed:', e.message);
            }
        }

        // ── 3. Critical Error if no API key or all attempts failed ──
        return NextResponse.json({
            error: 'Impossibile generare la strategia AI al momento.',
            details: 'Tutti i modelli AI (Gemini / Claude) hanno risposto con errore o le chiavi API non sono valide.',
            env_status: { gemini: !!geminiApiKey, anthropic: !!anthropicApiKey }
        }, { status: 500 });

    } catch (error: any) {
        console.error('CRITICAL ERROR in /api/social-strategy/generate:', error);
        return NextResponse.json({
            error: 'Errore interno del server durante la generazione.',
            details: error.message,
        }, { status: 500 });
    }
}
