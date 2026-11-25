/**
 * GET /api/admin/dealer-sheets  (solo amministratori)
 *
 * Per ogni cliente con uno Sheet collegato: scheda, ultima sincronizzazione e quanti problemi ha trovato. Serve alla pagina «Dati reali»
 * per mostrare, riga per riga, se lo Sheet è collegato e come è andata l'ultima lettura.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { forbiddenResponse, getAppUser, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { serviceAccountEmail } from '@/lib/dealer-kpi/sheets';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    if ((await getAppUser(user.uid))?.role !== 'Amministratore') return forbiddenResponse();

    const clients = await adminDb.collection('clients').get();
    const sheets: Record<string, { tab: string; lastStatus: string | null; lastSyncAt: string | null; lastMessage: string | null; issuesTotal: number; months: number; monthList: string[] }> = {};
    await Promise.all(clients.docs.map(async (c) => {
        const s = await c.ref.collection('private').doc('dealerSheet').get();
        if (!s.exists) return;
        const d = s.data() as { tab?: string; status?: { lastStatus?: string; lastSyncAt?: string; lastMessage?: string; issuesTotal?: number; months?: string[] } | null };
        sheets[c.id] = {
            tab: d.tab || 'Dati', lastStatus: d.status?.lastStatus ?? null, lastSyncAt: d.status?.lastSyncAt ?? null,
            lastMessage: d.status?.lastMessage ?? null, issuesTotal: d.status?.issuesTotal ?? 0, months: d.status?.months?.length ?? 0, monthList: d.status?.months ?? [],
        };
    }));
    return NextResponse.json({ sheets, serviceAccountEmail: serviceAccountEmail() });
}
