/**
 * GET  /api/outreach/commands  → i comandi in attesa (approva/rifiuta), per il ponte di Sellbird
 * POST /api/outreach/commands  → il ponte dice com'è andata: { id, ok, error?, result?, estimatedCost? }
 *
 * Autenticate con OUTREACH_BRIDGE_SECRET.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { denyUnlessBridge } from '@/lib/outreach';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const denied = denyUnlessBridge(request);
    if (denied) return denied;

    const snap = await adminDb.collection('outreachCommands').where('status', '==', 'pending').limit(50).get();
    const commands = snap.docs.map((d) => ({
        id: d.id,
        outboxId: d.get('outboxId') ?? null,
        action: d.get('action'),
        // Parametri delle azioni con parametri (Discover, segnali): il ponte li ricontrolla prima di usarli.
        provider: d.get('provider') ?? null,
        domain: d.get('domain') ?? null,
        cities: d.get('cities') ?? null,
        industries: d.get('industries') ?? null,
        maxSpend: d.get('maxSpend') ?? null,
        codes: d.get('codes') ?? null,
        signalStatus: d.get('signalStatus') ?? null,
    }));
    return NextResponse.json({ commands });
}

export async function POST(request: NextRequest) {
    const denied = denyUnlessBridge(request);
    if (denied) return denied;

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON non valido' }, { status: 400 });
    }
    if (typeof body?.id !== 'string' || !body.id) {
        return NextResponse.json({ error: 'id mancante' }, { status: 400 });
    }

    const ref = adminDb.collection('outreachCommands').doc(body.id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: 'Comando inesistente' }, { status: 404 });

    const cost = typeof body.estimatedCost === 'number' && Number.isFinite(body.estimatedCost) && body.estimatedCost >= 0 ? body.estimatedCost : null;
    await ref.update({
        status: body.ok === true ? 'applied' : 'failed',
        appliedAt: new Date().toISOString(),
        error: body.ok === true ? null : String(body.error ?? 'errore sconosciuto').slice(0, 500),
        // Il testo che Sellbird ha stampato (stima, riepilogo): serve a chi ha chiesto l'azione per decidere o per sapere com'è andata.
        result: typeof body.result === 'string' ? body.result.slice(0, 2000) : null,
        estimatedCost: cost,
    });
    return NextResponse.json({ ok: true });
}
