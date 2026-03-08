import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { prompt, systemPrompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const geminiApiKey = process.env.GEMINI_API_KEY;
        const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

        // Prefer Gemini if available, or if Anthropic is still placeholder
        if (geminiApiKey && geminiApiKey !== 'your_gemini_key_here') {
            console.log('Using Google Gemini API (v1/flash)...');
            const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `${systemPrompt}\n\nUSER REQUEST:\n${prompt}` }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 8192,
                        responseMimeType: "application/json",
                    }
                })
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({}));
                console.error('Gemini API error:', errorBody);
                return NextResponse.json({
                    error: 'Errore durante la generazione della strategia (Gemini API).',
                    details: errorBody.error?.message || response.statusText
                }, { status: response.status });
            }

            const result = await response.json();
            const content = result.candidates[0].content.parts[0].text;

            try {
                return NextResponse.json(JSON.parse(content));
            } catch (e) {
                console.error('Failed to parse Gemini response as JSON:', content);
                return NextResponse.json({ error: 'Risposta AI non valida (JSON corrotto)', rawContent: content }, { status: 500 });
            }
        }

        // Fallback or old Anthropic logic
        if (!anthropicApiKey || anthropicApiKey === 'your_api_key_here') {
            return NextResponse.json({ error: 'Configurazione mancante: Inserisci GEMINI_API_KEY o ANTHROPIC_API_KEY nel file .env.local' }, { status: 500 });
        }

        console.log('Falling back to Anthropic API...');
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': anthropicApiKey,
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
            console.error('Anthropic API error status:', response.status);
            console.error('Anthropic API error body:', JSON.stringify(errorBody, null, 2));
            return NextResponse.json({
                error: 'Errore durante la generazione della strategia (Anthropic API).',
                details: errorBody.error?.message || response.statusText,
                status: response.status
            }, { status: response.status });
        }

        const result = await response.json();
        console.log('Anthropic API response received successfully');

        if (!result.content || !result.content[0]) {
            throw new Error('Formato risposta Anthropic non valido');
        }

        const content = result.content[0].text;

        // The AI is instructed to return ONLY JSON.
        // We attempt to parse it or clean it if markdown backticks were added despite instructions.
        let jsonResult;
        try {
            const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
            jsonResult = JSON.parse(cleanContent);
        } catch (e) {
            console.error('Failed to parse AI response as JSON:', content);
            return NextResponse.json({ error: 'Invalid JSON response from AI', rawContent: content }, { status: 500 });
        }

        return NextResponse.json(jsonResult);

    } catch (error: any) {
        console.error('Error in social strategy generator API:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
