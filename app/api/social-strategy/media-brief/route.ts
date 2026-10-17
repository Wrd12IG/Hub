import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { askClaudeJson, isClaudeConfigured } from '@/lib/claude';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    // API call: /api/social-strategy/media-brief
    const auth = await verifyAuth(req);
    if (!auth) return unauthorizedResponse();
  const denied = await denyUnlessStaff(auth.uid);
  if (denied) return denied;

    try {
        const { topic, platform, mediaType, caption, clientName, toneOfVoice } = await req.json();

        if (!topic || !mediaType) {
            return NextResponse.json({ error: 'Topic and Media Type are required' }, { status: 400 });
        }

        if (!isClaudeConfigured()) {
            console.error('CRITICAL: ANTHROPIC_API_KEY non è definita nell\'ambiente del server.');
            return NextResponse.json({
                error: 'Configurazione API mancante in produzione.',
                details: 'Assicurati di aver aggiunto ANTHROPIC_API_KEY nelle variabili d\'ambiente del server (es. Dashboard Vercel).',
                env_status: false,
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

ISTRUZIONI SPECIALI PER ${mediaType}:
${mediaType === 'Carosello' ? '- Genera esattamente 5-7 slide. Per ogni slide specifica: Titolo Gancio, Testo di supporto, Descrizione dell\'elemento visivo (foto/icona) e Call to Action finale.' : '- Fornisci una visione d\'insieme artistica e tecnica coerente con il brand.'}

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

        try {
            return NextResponse.json(await askClaudeJson({ prompt: systemPrompt, maxTokens: 2000, temperature: 0.7, timeoutMs: 55_000 }));
        } catch (e: any) {
            const nonLeggibile = /non leggibile/.test(e.message);
            return NextResponse.json(
                nonLeggibile ? { error: 'JSON non valido' } : { error: 'Errore generazione brief media', details: e.message },
                { status: 500 },
            );
        }

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
