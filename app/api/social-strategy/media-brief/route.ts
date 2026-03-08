import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    console.log('>>> API CALL: /api/social-strategy/media-brief');
    try {
        const { topic, platform, mediaType, caption, clientName, toneOfVoice } = await req.json();

        if (!topic || !mediaType) {
            return NextResponse.json({ error: 'Topic and Media Type are required' }, { status: 400 });
        }

        const geminiApiKey = process.env.GEMINI_API_KEY;

        if (!geminiApiKey || geminiApiKey === 'your_gemini_key_here') {
            console.error('CRITICAL: GEMINI_API_KEY is not defined in production environment.');
            return NextResponse.json({
                error: 'Configurazione API mancante in produzione.',
                details: 'Assicurati di aver aggiunto GEMINI_API_KEY nelle variabili d\'ambiente del server (es. Dashboard Vercel).',
                env_status: !!geminiApiKey
            }, { status: 500 });
        }

        const systemPrompt = `Sei un esperto Social Media Manager e Creative Director per l'agenzia WRDigital. 
Il tuo compito è generare un brief dettagliato per la creazione di un contenuto multimediale specifico per un post social.

Dati del cliente:
- Nome: ${clientName || 'N/D'}
- Tono di voce: ${toneOfVoice || 'Professionale'}

Contesto del post:
- Topic: ${topic}
- Piattaforma: ${platform}
- Caption prevista: ${caption}

Tipo di Media richiesto: ${mediaType}

Genera un JSON con questa struttura:
{
  "tipo_media": "${mediaType}",
  "titolo_progetto": "string",
  "descrizione_creativa": "string (una visione d'insieme del contenuto)",
  "struttura": [
    { "elemento": "string (scena 1, slide 1, sezione foto...)", "dettagli": "string (cosa accade, cosa si vede, testo sovrimpresso)" }
  ],
  "note_tecniche": "string (formato video, luci, stile grafico)",
  "consiglio_esperto": "string (un tip per massimizzare l'engagement)"
}

Restituisci SOLO il JSON pulito.`;

        const model = 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2000,
                    responseMimeType: "application/json",
                }
            })
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            return NextResponse.json({
                error: 'Errore generazione brief media',
                details: errorBody.error?.message || response.statusText
            }, { status: 500 });
        }

        const result = await response.json();
        const content = result.candidates[0].content.parts[0].text;

        try {
            const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
            return NextResponse.json(JSON.parse(cleanContent));
        } catch (e) {
            return NextResponse.json({ error: 'JSON non valido', raw: content }, { status: 500 });
        }

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
