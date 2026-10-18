// Generazione immagini con Nano Banana (modelli immagine Gemini di Google).
// Il prompt lo scrive Claude; qui si fa solo la chiamata REST, con più modelli in ripiego.

export const NANO_BANANA_MODELS = ['gemini-2.5-flash-image', 'gemini-3-pro-image-preview'];

export function isNanoBananaConfigured(): boolean {
    const key = process.env.GEMINI_API_KEY;
    return !!key && !/^your_/.test(key);
}

export interface NanoBananaOptions {
    aspectRatio?: '1:1' | '4:5' | '3:4' | '9:16' | '16:9';
    timeoutMs?: number;
}

/** Estrae la prima immagine inline dalla risposta di generateContent come data URL. */
export function extractImageDataUrl(data: any): string | null {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return null;
    for (const part of parts) {
        const inline = part.inlineData || part.inline_data;
        if (inline?.data) return `data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`;
    }
    return null;
}

/** Restituisce l'immagine come data URL; lancia un errore con il motivo di ogni modello se tutti falliscono. */
export async function generateImage(prompt: string, options: NanoBananaOptions = {}): Promise<string> {
    if (!isNanoBananaConfigured()) throw new Error('GEMINI_API_KEY non configurata');
    const errors: string[] = [];

    for (const model of NANO_BANANA_MODELS) {
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY as string },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseModalities: ['IMAGE'],
                        imageConfig: { aspectRatio: options.aspectRatio || '1:1' },
                    },
                }),
                signal: AbortSignal.timeout(options.timeoutMs ?? 40_000),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                errors.push(`${model}: ${data?.error?.message || res.statusText}`);
                continue;
            }
            const image = extractImageDataUrl(data);
            if (image) return image;
            errors.push(`${model}: nessuna immagine nella risposta${data?.promptFeedback?.blockReason ? ` (bloccata: ${data.promptFeedback.blockReason})` : ''}`);
        } catch (e: any) {
            errors.push(`${model}: ${e.message}`);
        }
    }
    throw new Error(errors.join(' | '));
}
