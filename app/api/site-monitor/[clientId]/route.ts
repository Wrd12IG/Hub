/**
 * /api/site-monitor/[clientId]
 *
 * GET  → stato, problemi e ultime scansioni del cliente.
 * POST → { action: 'scan', dryRun? } | { action: 'create_tasks', fingerprints? } | { action: 'ignore', fingerprints } | { action: 'settings', enabled?, assigneeIds? }
 * Solo amministratori.
 */
import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse, getAppUser, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { firestoreStore } from '@/lib/site-monitor/store';
import { createTasksNow, MonitorConfigError, runClientScan } from '@/lib/site-monitor/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Ctx = { params: { clientId: string } };
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

async function guard(request: NextRequest, clientId: string): Promise<NextResponse | null> {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    if ((await getAppUser(user.uid))?.role !== 'Amministratore') return forbiddenResponse();
    if (!ID_RE.test(clientId)) return NextResponse.json({ error: 'cliente non valido' }, { status: 400 });
    return null;
}

export async function GET(request: NextRequest, { params }: Ctx) {
    const denied = await guard(request, params.clientId);
    if (denied) return denied;
    const store = await firestoreStore();
    const { adminDb } = await import('@/lib/firebase-admin');
    const [state, findings, scans] = await Promise.all([
        store.getState(params.clientId),
        store.getFindings(params.clientId),
        adminDb.collection('clients').doc(params.clientId).collection('siteScans').orderBy('startedAt', 'desc').limit(10).get(),
    ]);
    return NextResponse.json({ state, findings, scans: scans.docs.map((d) => d.data()) });
}

export async function POST(request: NextRequest, { params }: Ctx) {
    const denied = await guard(request, params.clientId);
    if (denied) return denied;
    const body = (await request.json().catch(() => ({}))) as { action?: string; dryRun?: boolean; fingerprints?: unknown; enabled?: unknown; assigneeIds?: unknown };
    const fps = Array.isArray(body.fingerprints) ? body.fingerprints.filter((x): x is string => typeof x === 'string' && ID_RE.test(x)).slice(0, 200) : undefined;
    try {
        switch (body.action) {
            case 'scan':
                return NextResponse.json(await runClientScan(params.clientId, { dryRun: body.dryRun === true, createTasks: false }));
            case 'create_tasks':
                return NextResponse.json(await createTasksNow(params.clientId, fps));
            case 'ignore': {
                if (!fps?.length) return NextResponse.json({ error: 'nessun problema indicato' }, { status: 400 });
                const store = await firestoreStore();
                const set = new Set(fps);
                const toIgnore = (await store.getFindings(params.clientId)).filter((f) => set.has(f.fingerprint) && f.status === 'nuovo');
                await store.saveFindings(params.clientId, toIgnore.map((f) => ({ ...f, status: 'ignorato' as const })));
                return NextResponse.json({ ignored: toIgnore.length });
            }
            case 'settings': {
                const store = await firestoreStore();
                const prev = await store.getState(params.clientId);
                const ids = Array.isArray(body.assigneeIds) ? body.assigneeIds.filter((x): x is string => typeof x === 'string' && ID_RE.test(x)).slice(0, 20) : undefined;
                await store.saveState(params.clientId, {
                    month: prev?.month ?? '', creditsUsed: prev?.creditsUsed ?? 0,
                    ...(typeof body.enabled === 'boolean' ? { enabled: body.enabled } : {}),
                    ...(ids ? { assigneeIds: ids } : {}),
                });
                return NextResponse.json({ ok: true });
            }
            default:
                return NextResponse.json({ error: 'azione sconosciuta' }, { status: 400 });
        }
    } catch (e) {
        if (e instanceof MonitorConfigError) return NextResponse.json({ error: e.message }, { status: 422 });
        console.error('[site-monitor]', e);
        return NextResponse.json({ error: 'errore interno' }, { status: 500 });
    }
}
