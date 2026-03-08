import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
    try {
        const { topic, platform, mediaType, clientName, toneOfVoice } = await req.json();

        const geminiApiKey = process.env.GEMINI_API_KEY;

        if (!geminiApiKey || geminiApiKey === 'your_gemini_key_here') {
            return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
        }

        // 1. Use Gemini 2.0 Flash to generate a "Perfect Creative Prompt"
        const promptModel = 'gemini-2.0-flash';
        const promptUrl = `https://generativelanguage.googleapis.com/v1beta/models/${promptModel}:generateContent?key=${geminiApiKey}`;

        const visualSystemPrompt = `Sei un esperto Visual Designer. Crea un prompt in INGLESE per generare un'immagine fotografica di altissima qualità (stile editoriale, 8k, bokeh) per un post social.
        Dati:
        - Cliente: ${clientName || 'N/D'}
        - Topic: ${topic}
        - Piattaforma: ${platform}
        - Media: ${mediaType}

        Sii descrittivo, evita testi nell'immagine, concentrati su texture, luci e composizione. Rispondi SOLO con il prompt in inglese.`;

        const promptResponse = await fetch(promptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: visualSystemPrompt }] }]
            })
        });

        let imagePrompt = `${topic} professional social media photography`;
        if (promptResponse.ok) {
            const promptResult = await promptResponse.json();
            imagePrompt = promptResult.candidates[0].content.parts[0].text.trim();
        }

        // 2. Try to generate REAL image using Gemini Imagen 3
        try {
            const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3:generateImages?key=${geminiApiKey}`;
            const imagenResponse = await fetch(imagenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: imagePrompt,
                    numberOfImages: 1,
                })
            });

            if (imagenResponse.ok) {
                const imagenData = await imagenResponse.json();
                if (imagenData.images && imagenData.images[0]) {
                    const base64 = imagenData.images[0].base64Data;
                    const mimeType = imagenData.images[0].mimeType || 'image/png';
                    return NextResponse.json({ imageUrl: `data:${mimeType};base64,${base64}` });
                }
            }
        } catch (e) {
            console.error('Gemini Imagen 3 not available or failed:', e);
        }

        // 3. Fallback: High-quality dynamic placeholder
        const placeholders = [
            'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=80',
        ];

        const imageUrl = placeholders[Math.floor(Math.random() * placeholders.length)];
        return NextResponse.json({ imageUrl });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
