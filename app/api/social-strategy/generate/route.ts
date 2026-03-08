import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { prompt, systemPrompt } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Anthropic API key is missing' }, { status: 500 });
        }

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022', // Use the best available Sonnet model
                max_tokens: 4000,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: prompt }
                ]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Anthropic API error:', error);
            return NextResponse.json({ error: 'Failed to generate strategy' }, { status: response.status });
        }

        const result = await response.json();
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
