/** POST /api/clients/[id]/dealer-kpi/sync — legge lo Sheet del cliente e aggiorna i dati (solo amministratori). */
import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse, getAppUser, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { firestoreDealerStore } from '@/lib/dealer-kpi/firestore-store';
import { googleSheetsReader } from '@/lib/dealer-kpi/sheets';
import { syncClient } from '@/lib/dealer-kpi/sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    if ((await getAppUser(user.uid))?.role !== 'Amministratore') return forbiddenResponse();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(params.id)) return NextResponse.json({ error: 'Cliente non valido' }, { status: 400 });
    try {
        const status = await syncClient(params.id, { store: firestoreDealerStore, reader: googleSheetsReader, now: new Date() });
        return NextResponse.json({ status });
    } catch (e) {
        console.error('[dealer-kpi sync]', e);
        return NextResponse.json({ error: 'Errore durante la sincronizzazione' }, { status: 500 });
    }
}
