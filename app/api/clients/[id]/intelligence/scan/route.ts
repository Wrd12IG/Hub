/**
 * POST /api/clients/[id]/intelligence/scan
 * Avvia un'analisi AI dei competitor del cliente (Gemini)
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await verifyAuth(request);
  if (!user) return unauthorizedResponse();

  const { id: clientId } = params;

  try {
    const body = await request.json().catch(() => ({}));
    const { targetUrl, competitors = [], focus = 'general' } = body as {
      targetUrl?: string;
      competitors?: string[];
      focus?: string;
    };

    // Get competitors from Firestore if not provided
    let competitorList = competitors;
    if (!competitorList.length) {
      const snap = await adminDb
        .collection('clients')
        .doc(clientId)
        .collection('intelligence')
        .doc('competitors')
        .get();
      const data = snap.data() || {};
      competitorList = (data.list || []).map((c: { url: string }) => c.url).filter(Boolean);
    }

    if (!competitorList.length && !targetUrl) {
      return NextResponse.json(
        { error: 'Nessun competitor configurato. Aggiungi almeno un competitor prima di avviare una scansione.' },
        { status: 400 }
      );
    }

    // Build Gemini prompt
    const prompt = `
Sei un esperto di marketing digitale e SEO. Analizza il seguente scenario competitivo:

Cliente target: ${targetUrl || 'Sito del cliente'}
Competitor da analizzare: ${competitorList.join(', ')}
Focus dell'analisi: ${focus}

Fornisci un'analisi strutturata in formato JSON con i seguenti campi:
{
  "summary": "Sintesi esecutiva (3-4 frasi)",
  "strengthOpportunities": ["Opportunità 1", "Opportunità 2", ...],
  "threats": ["Minaccia 1", "Minaccia 2", ...],
  "recommendations": [
    { "priority": "high|medium|low", "action": "Azione specifica", "impact": "Impatto atteso" }
  ],
  "keyDifferentiators": ["Differenziatore 1", ...],
  "contentGaps": ["Gap di contenuto 1", ...],
  "technicalAdvantages": ["Vantaggio tecnico 1", ...]
}

Rispondi SOLO con il JSON, senza markdown o testo aggiuntivo.
    `.trim();

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let analysis;
    try {
      analysis = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
      analysis = { summary: text, raw: true };
    }

    // Save analysis to Firestore
    const scanRecord = {
      analysis,
      targetUrl,
      competitors: competitorList,
      focus,
      createdAt: new Date().toISOString(),
      createdBy: user.uid,
    };

    await adminDb
      .collection('clients')
      .doc(clientId)
      .collection('intelligence')
      .doc('competitors')
      .set({ analyses: [scanRecord] }, { merge: true });

    return NextResponse.json({ success: true, analysis });
  } catch (error) {
    console.error(`[intelligence/scan] Error for client ${clientId}:`, error);
    return NextResponse.json({ error: 'Failed to complete intelligence scan' }, { status: 500 });
  }
}
