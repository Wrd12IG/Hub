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
            // Updated model name to match current Google AI Studio Imagen 3 availability
            const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages?key=${geminiApiKey}`;
            const imagenResponse = await fetch(imagenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: imagePrompt,
                    numberOfImages: 1,
                    safetySettings: [
                        { category: "HATE_SPEECH", threshold: "BLOCK_NONE" },
                        { category: "HARASSMENT", threshold: "BLOCK_NONE" },
                        { category: "SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                        { category: "DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                    ]
                })
            });

            if (imagenResponse.ok) {
                const imagenData = await imagenResponse.json();
                if (imagenData.images && imagenData.images[0]) {
                    const base64 = imagenData.images[0].base64Data;
                    const mimeType = imagenData.images[0].mimeType || 'image/png';
                    return NextResponse.json({ imageUrl: `data:${mimeType};base64,${base64}` });
                }
            } else {
                console.error('Imagen 3 API returned error:', await imagenResponse.text());
            }
        } catch (e) {
            console.error('Gemini Imagen 3 not available or failed:', e);
        }

        // 3. Fallback: High-quality UNIQUE placeholder based on TOPIC
        // If Imagen fails, we use a search-based unsplash URL to ensure post diversity.
        const encodedTopic = encodeURIComponent(topic || 'business');
        const randomSeed = Math.floor(Math.random() * 1000);
        const imageUrl = `https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=80&sig=${encodedTopic}-${randomSeed}`;

        // Alternative reliable unique image service
        const finalUrl = `https://loremflickr.com/800/600/${encodedTopic}?random=${randomSeed}`;

        return NextResponse.json({ imageUrl: finalUrl });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
