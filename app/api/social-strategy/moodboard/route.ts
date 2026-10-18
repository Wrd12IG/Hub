import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { askClaude, isClaudeConfigured } from '@/lib/claude';
import { generateImage, isNanoBananaConfigured } from '@/lib/nano-banana';

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
                imagePrompt = (await askClaude({ prompt: visualSystemPrompt, maxTokens: 400, timeoutMs: 25_000 })).trim();
            } catch (e: any) {
                console.error('Claude non ha scritto il prompt immagine, uso quello di base:', e.message);
            }
        }

        // 2. L'immagine la genera Nano Banana (Gemini image) con il prompt scritto da Claude.
        let imageError: string | undefined;
        if (isNanoBananaConfigured()) {
            try {
                const aspectRatio = platform === 'instagram' ? '4:5' : mediaType === 'video' ? '9:16' : '1:1';
                return NextResponse.json({ imageUrl: await generateImage(imagePrompt, { aspectRatio }) });
            } catch (e: any) {
                imageError = e.message;
                console.error('Nano Banana non ha generato l\'immagine:', e.message);
            }
        }

        // 3. Fallback: High-quality UNIQUE placeholder based on TOPIC
        // Se Nano Banana non è disponibile, we use a search-based unsplash URL to ensure post diversity.
        const encodedTopic = encodeURIComponent(topic || 'business');
        const randomSeed = Math.floor(Math.random() * 1000);
        const imageUrl = `https://images.unsplash.com/photo-1542744173-8e7e53415bb0?auto=format&fit=crop&w=800&q=80&sig=${encodedTopic}-${randomSeed}`;

        // Alternative reliable unique image service
        const finalUrl = `https://loremflickr.com/800/600/${encodedTopic}?random=${randomSeed}`;

        return NextResponse.json({ imageUrl: finalUrl, fallback: true, ...(imageError ? { imageError } : {}) });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
