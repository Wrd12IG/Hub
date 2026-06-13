import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Set to 60 seconds (max for Vercel Pro, default is 10s on Hobby)

export async function POST(req: NextRequest) {
    console.log('>>> API CALL: /api/social-strategy/generate');
    try {
        const { prompt, systemPrompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const geminiApiKey = process.env.GEMINI_API_KEY;
        const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

        const isGeminiValid = geminiApiKey && geminiApiKey !== 'your_gemini_key_here';
        const isAnthropicValid = anthropicApiKey && anthropicApiKey !== 'your_api_key_here';

        // Prefer Gemini if available
        if (isGeminiValid) {
            const model = 'gemini-2.0-flash';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    system_instruction: {
                        parts: [{ text: systemPrompt }]
                    },
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 5000,
                        responseMimeType: "application/json",
                    }
                })
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                console.error('Gemini API error:', JSON.stringify(errorBody, null, 2));

                const status = response.status === 404 ? 500 : response.status;

                return NextResponse.json({
                    error: 'Errore durante la generazione della strategia (Gemini API).',
                    details: errorBody.error?.message || response.statusText,
                    code: errorBody.error?.code,
                    status: response.status
                }, { status });
            }

            const result = await response.json();

            if (!result.candidates || !result.candidates[0] || !result.candidates[0].content) {
                return NextResponse.json({
                    error: 'Risposta AI non valida o bloccata (Safety/Limit)',
                    details: 'No candidate content found',
                    raw_result: result
                }, { status: 500 });
            }

            const content = result.candidates[0].content.parts[0].text;

            try {
                // Find start and end of JSON if AI added extra text
                const startIdx = content.indexOf('{');
                const endIdx = content.lastIndexOf('}');

                if (startIdx === -1 || endIdx === -1) {
                    throw new Error('No JSON structure found in response content');
                }

                const jsonStr = content.substring(startIdx, endIdx + 1);
                return NextResponse.json(JSON.parse(jsonStr));
            } catch (e: any) {
                console.error('Failed to parse Gemini response as JSON:', content);
                return NextResponse.json({
                    error: 'AI output non valida (JSON parsing)',
                    details: e.message,
                    content_preview: content.length > 200 ? content.substring(0, 200) + '...' : content
                }, { status: 500 });
            }
        }

        // Check if anything is configured
        if (!isAnthropicValid && !isGeminiValid) {
            console.error('CRITICAL: All AI API Keys are missing in production.');
            return NextResponse.json({
                error: 'Configurazione AI mancante in questo ambiente (Web/Prod).',
                details: 'Le variabili d\'ambiente (GEMINI_API_KEY) devono essere configurate nel pannello di controllo del server (es. Dashboard Vercel). Mentre in locale funzionano con .env.local, sul web vanno aggiunte a mano.',
                env_status: { gemini: !!geminiApiKey, anthropic: !!anthropicApiKey }
            }, { status: 500 });
        }

        // Fallback or old Anthropic logic
        console.log('Falling back to Anthropic API...');
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

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            return NextResponse.json({
                error: 'Errore durante la generazione della strategia (Anthropic API).',
                details: errorBody.error?.message || response.statusText,
                status: response.status
            }, { status: response.status });
        }

        const result = await response.json();
        const content = result.content[0].text;

        try {
            const startIdx = content.indexOf('{');
            const endIdx = content.lastIndexOf('}');
            const jsonStr = content.substring(startIdx, endIdx + 1);
            return NextResponse.json(JSON.parse(jsonStr));
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON response from AI', rawContent: content }, { status: 500 });
        }

    } catch (error: any) {
        console.error('CRITICAL ERROR in /api/social-strategy/generate:', error);
        return NextResponse.json({
            error: 'Errore interno del server durante la generazione.',
            details: error.message,
        }, { status: 500 });
    }
}
