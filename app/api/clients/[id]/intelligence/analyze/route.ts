/**
 * POST /api/clients/[id]/intelligence/analyze
 * Analisi AI del sito del cliente: legge la home, la fa riassumere a Claude (target, competitor, interessi Meta)
 * e salva il risultato in `clients/{id}.intelligence`, che è ciò che la scheda "AI Intelligence" mostra.
 * Solo staff: ogni analisi consuma crediti AI.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { assertPublicHttpUrl, htmlToText, buildPrompt, normalizeIntelligence } from '@/lib/site-intelligence';
import { askClaudeJson } from '@/lib/claude';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 2_000_000;

/** Scarica la pagina seguendo i redirect a mano: ogni passaggio deve restare su un host pubblico. */
async function fetchPage(rawUrl: string): Promise<{ url: string; html: string }> {
    let url = assertPublicHttpUrl(rawUrl);
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
        const res = await fetch(url.href, {
            redirect: 'manual',
            signal: AbortSignal.timeout(12_000),
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WRDigitalHub/1.0)', Accept: 'text/html' },
        });
        if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
            url = assertPublicHttpUrl(new URL(res.headers.get('location')!, url).href);
            continue;
        }
        if (!res.ok) throw new Error(`Il sito ha risposto ${res.status}`);
        const html = (await res.text()).slice(0, MAX_HTML_BYTES);
        return { url: url.href, html };
    }
    throw new Error('Troppi reindirizzamenti leggendo il sito');
}

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

        await clientRef.set({ intelligence, intelligenceUpdatedAt: Date.now(), intelligenceUpdatedBy: user.uid }, { merge: true });
        return NextResponse.json({ success: true, intelligence });
    } catch (err: any) {
        console.error(`[intelligence/analyze] ${params.id}:`, err.message);
        const known = /sito|indirizzo|reindirizz|ANTHROPIC|Claude|Risposta AI/i.test(err.message);
        return NextResponse.json({ error: known ? err.message : 'Analisi non riuscita' }, { status: known ? 422 : 500 });
    }
}
