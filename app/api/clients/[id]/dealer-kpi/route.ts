/**
 * /api/clients/[id]/dealer-kpi
 *
 * GET → collegamento allo Sheet, stato dell'ultima sincronizzazione e totali per mese (staff).
 * PUT { sheetUrl, tab? } → collega (o, con sheetUrl vuoto, scollega) lo Sheet del cliente (solo amministratori).
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { denyUnlessStaff, forbiddenResponse, getAppUser, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { firestoreDealerStore, loadMonthTotals, removeSheetConfig, saveSheetConfig } from '@/lib/dealer-kpi/firestore-store';
import { serviceAccountEmail } from '@/lib/dealer-kpi/sheets';
import { extractSpreadsheetId, validTabName } from '@/lib/dealer-kpi/sheet-url';

export const dynamic = 'force-dynamic';

const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    const denied = await denyUnlessStaff(user.uid);
    if (denied) return denied;
    if (!ID_RE.test(params.id)) return NextResponse.json({ error: 'Cliente non valido' }, { status: 400 });
    const client = await adminDb.collection('clients').doc(params.id).get();
    if (!client.exists) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });
    const config = await firestoreDealerStore.getConfig(params.id);
    return NextResponse.json({
        clientName: String(client.get('name') ?? params.id),
        config, serviceAccountEmail: serviceAccountEmail(),
        months: config ? await loadMonthTotals(params.id) : [],
    });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    if ((await getAppUser(user.uid))?.role !== 'Amministratore') return forbiddenResponse();
    if (!ID_RE.test(params.id)) return NextResponse.json({ error: 'Cliente non valido' }, { status: 400 });
    const client = await adminDb.collection('clients').doc(params.id).get();
    if (!client.exists) return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as { sheetUrl?: unknown; tab?: unknown };
    const url = typeof body.sheetUrl === 'string' ? body.sheetUrl.trim() : '';
    if (!url) { await removeSheetConfig(params.id); return NextResponse.json({ ok: true, removed: true }); }
    const spreadsheetId = extractSpreadsheetId(url);
    if (!spreadsheetId) return NextResponse.json({ error: 'Indirizzo dello Sheet non valido: incolla il collegamento di Google Sheets.' }, { status: 400 });
    const tab = typeof body.tab === 'string' && body.tab.trim() ? body.tab.trim() : 'Dati';
    if (!validTabName(tab)) return NextResponse.json({ error: 'Nome della scheda non valido.' }, { status: 400 });
    await saveSheetConfig(params.id, { spreadsheetId, tab });
    return NextResponse.json({ ok: true });
}
