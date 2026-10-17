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
        const { topic, platform, mediaType, clientName, toneOfVoice } = await req.json();

        // 1. Claude scrive il prompt creativo per l'immagine
        const visualSystemPrompt = `Sei un esperto Visual Designer. Crea un prompt in INGLESE per generare un'immagine fotografica di altissima qualità (stile editoriale, 8k, bokeh) per un post social.
        Dati:
        - Cliente: ${clientName || 'N/D'}
        - Topic: ${topic}
        - Piattaforma: ${platform}
        - Media: ${mediaType}

        Sii descrittivo, evita testi nell'immagine, concentrati su texture, luci e composizione. Rispondi SOLO con il prompt in inglese.`;

        let imagePrompt = `${topic} professional social media photography`;
        if (isClaudeConfigured()) {
            try {
                imagePrompt = (await askClaude({ prompt: visualSystemPrompt, maxTokens: 400, temperature: 0.8, timeoutMs: 25_000 })).trim();
            } catch (e: any) {
                console.error('Claude non ha scritto il prompt immagine, uso quello di base:', e.message);
            }
        }

        // 2. L'IMMAGINE vera la genera ancora Google Imagen 3: Claude non genera immagini.
        //    Senza GEMINI_API_KEY si salta e si usa l'immagine di ripiego del punto 3.
        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (geminiApiKey && !/^your_/.test(geminiApiKey)) try {
            // Updated model name to match current Google AI Studio Imagen 3 availability
            const imagenUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages?key=${geminiApiKey}`;
            const imagenResponse = await fetch(imagenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: imagePrompt,
                    numberOfImages: 1,
                    safetySettings: [
                        { category: "HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
                        { category: "HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
                        { category: "SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
                        { category: "DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" }
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
