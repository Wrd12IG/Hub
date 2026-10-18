/**
 * POST /api/clients/[id]/intelligence/analyze
 * Analisi AI del sito del cliente: legge la home, la fa riassumere a Claude (target, competitor, interessi Meta)
 * e salva il risultato in `clients/{id}.intelligence`, che è ciò che la scheda "AI Intelligence" mostra.
 * Solo staff: ogni analisi consuma crediti AI.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { htmlToText, buildPrompt, normalizeIntelligence } from '@/lib/site-intelligence';
import { fetchPage } from '@/lib/safe-fetch';
import { askClaudeJson } from '@/lib/claude';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    const denied = await denyUnlessStaff(user.uid);
    if (denied) return denied;

    const clientRef = adminDb.collection('clients').doc(params.id);
    const snap = await clientRef.get();
    if (!snap.exists) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });
    const client = snap.data() as any;

    try {
        // Sito e nome vengono dal cliente salvato, non dal corpo della richiesta
        const page = await fetchPage(String(client.websiteUrl || ''));
        const text = htmlToText(page.html);
        if (text.length < 200) {
            return NextResponse.json(
                { error: 'Dalla home non si legge abbastanza testo (il sito potrebbe caricarsi solo con JavaScript). Inserisci i dati a mano.' },
                { status: 422 },
            );
        }

        const prompt = buildPrompt({ name: String(client.name || ''), industry: client.industry, url: page.url, text });
        const intelligence = normalizeIntelligence(await askClaudeJson({ prompt, maxTokens: 4096 }));

        // JSON round trip: toglie ogni `undefined` residuo, che Firestore rifiuta (il progetto non ha ignoreUndefinedProperties)
        await clientRef.set(JSON.parse(JSON.stringify({ intelligence, intelligenceUpdatedAt: Date.now(), intelligenceUpdatedBy: user.uid })), { merge: true });
        return NextResponse.json({ success: true, intelligence });
    } catch (err: any) {
        console.error(`[intelligence/analyze] ${params.id}:`, err.message);
        const known = /sito|indirizzo|reindirizz|ANTHROPIC|Claude|Risposta AI/i.test(err.message);
        // Route solo staff: si mostra la causa vera. Prima 'Analisi non riuscita' nascondeva sia il guasto di Claude sia questo di Firestore.
        return NextResponse.json({ error: known ? err.message : `Analisi non riuscita: ${String(err.message).slice(0, 200)}` }, { status: known ? 422 : 500 });
    }
}
