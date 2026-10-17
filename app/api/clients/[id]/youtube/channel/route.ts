/**
 * Modalità YouTube "solo dati pubblici": si salva solo l'ID del canale, niente token.
 * GET    → canale impostato (e se la chiave API è disponibile)
 * POST   → { channel } ID canale, link /channel/UC... o @handle: lo verifica con YouTube e lo salva
 * DELETE → rimuove la modalità
 * Solo staff: la configurazione delle integrazioni non è per i clienti.
 */
import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessStaff } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { parseChannelInput, resolvePublicChannel } from '@/lib/youtube-public';

const docRef = (clientId: string) =>
    adminDb.collection('clients').doc(clientId).collection('integrations').doc('youtube_public');

async function staffOnly(request: NextRequest) {
    const user = await verifyAuth(request);
    if (!user) return { error: unauthorizedResponse() };
    const denied = await denyUnlessStaff(user.uid);
    if (denied) return { error: denied };
    return { user };
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const auth = await staffOnly(request);
    if (auth.error) return auth.error;

    const snap = await docRef(params.id).get();
    const data = snap.exists ? snap.data() : null;
    return NextResponse.json({
        configured: !!data?.channelId,
        channelId: data?.channelId ?? null,
        channelName: data?.channelName ?? null,
        apiKeyAvailable: !!process.env.YOUTUBE_API_KEY,
    });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    const auth = await staffOnly(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const input = String(body?.channel || '');
    if (!parseChannelInput(input)) {
        return NextResponse.json(
            { error: 'Inserisci l\'ID del canale (inizia con UC), un link youtube.com/channel/... oppure un @handle' },
            { status: 400 },
        );
    }

    try {
        const channel = await resolvePublicChannel(input);
        if (!channel) return NextResponse.json({ error: 'Nessun canale YouTube trovato con questo ID' }, { status: 404 });

        await docRef(params.id).set({
            channelId: channel.id,
            channelName: channel.title,
            updatedAt: Date.now(),
            updatedBy: auth.user!.uid,
        });
        return NextResponse.json({
            success: true,
            channelId: channel.id,
            channelName: channel.title,
            subscribers: channel.subscribers,
        });
    } catch (err: any) {
        const status = /non configurata/.test(err.message) ? 503 : 502;
        return NextResponse.json({ error: err.message }, { status });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    const auth = await staffOnly(request);
    if (auth.error) return auth.error;

    await docRef(params.id).delete();
    return NextResponse.json({ success: true });
}
