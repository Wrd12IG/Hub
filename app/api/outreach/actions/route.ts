/**
 * POST /api/outreach/actions
 *   { action: 'discover_estimate', provider, cities, industries }   stima il costo di una ricerca (gratis)
 *   { action: 'discover_run', estimateId }                  la lancia, con il tetto calcolato qui dalla stima
 *   { action: 'signals_set', codes, status }                attiva o esclude segnali GRATUITI
 *
 * Come approva/rifiuta, non tocca Sellbird: registra un comando che il ponte ritira e applica. I parametri si
 * controllano qui (lib/outreach-actions.ts) e di nuovo nel ponte. Solo amministratori.
 *
 * Una ricerca (discover_run) parte solo da una stima appena fatta, valida mezz'ora e usabile una volta: così
 * chi preme «Esegui» sa quanto costa, e un doppio clic non spende due volte.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { forbiddenResponse, getAppUser, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { buildActionCommand, type ActionCommand, type ActionContext } from '@/lib/outreach-actions';
import { parseDiscoverInfo, parseSignalItem, type OutreachSignalItem } from '@/lib/outreach';

export const dynamic = 'force-dynamic';

const DISCOVER = ['discover_estimate', 'discover_run'];

export async function POST(request: NextRequest) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    if ((await getAppUser(user.uid))?.role !== 'Amministratore') return forbiddenResponse();

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'JSON non valido' }, { status: 400 });
    }

    const meta = await adminDb.collection('outreachMeta').doc('current').get();
    const signals = (Array.isArray(meta.get('signals')) ? meta.get('signals') : [])
        .map(parseSignalItem)
        .filter((x: OutreachSignalItem | null): x is OutreachSignalItem => x !== null);
    const base: ActionContext = { discover: parseDiscoverInfo(meta.get('discover')), signals };
    const commands = adminDb.collection('outreachCommands');

    // Una sola ricerca alla volta: la seconda partirebbe prima che il ponte abbia finito la prima.
    if (DISCOVER.includes(body?.action)) {
        const pending = await commands.where('status', '==', 'pending').get();
        if (pending.docs.some((d) => DISCOVER.includes(d.get('action')))) {
            return NextResponse.json({ error: 'C\'è già una ricerca in attesa o in corso.' }, { status: 409 });
        }
    }

    const doc = (c: ActionCommand) => ({
        ...c,
        ...(c.action === 'signals_set' ? { signalStatus: c.status } : {}),
        status: 'pending',
        requestedBy: user.email ?? user.uid,
        requestedAt: new Date().toISOString(),
    });
    // `status` dei segnali e `status` del comando erano lo stesso nome: i segnali stanno in signalStatus (e `status` torna 'pending').
    const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

    if (body?.action === 'discover_run') {
        const estimateId = typeof body?.estimateId === 'string' ? body.estimateId : '';
        if (!estimateId || !/^[A-Za-z0-9]{10,40}$/.test(estimateId)) return NextResponse.json({ error: 'Serve prima una stima del costo.' }, { status: 400 });
        const ref = commands.doc(estimateId);
        try {
            const out = await adminDb.runTransaction(async (tx) => {
                const snap = await tx.get(ref);
                const estimate =
                    snap.exists && snap.get('action') === 'discover_estimate'
                        ? {
                              provider: String(snap.get('provider') ?? ''),
                              cities: (snap.get('cities') ?? []) as string[],
                              industries: (snap.get('industries') ?? []) as string[],
                              estimatedCost: typeof snap.get('estimatedCost') === 'number' ? (snap.get('estimatedCost') as number) : null,
                              ok: snap.get('status') === 'applied',
                              requestedAt: String(snap.get('requestedAt') ?? ''),
                              used: snap.get('used') === true,
                          }
                        : null;
                const built = buildActionCommand(body, { ...base, estimate });
                if (!built.ok) return built;
                tx.update(ref, { used: true });
                tx.set(commands.doc(), clean(doc(built.command)));
                return built;
            });
            if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
            return NextResponse.json({ ok: true, maxSpend: (out.command as any).maxSpend });
        } catch (e: any) {
            console.error('[outreach/actions] discover_run', e);
            return NextResponse.json({ error: 'Non sono riuscito a registrare la ricerca.' }, { status: 500 });
        }
    }

    const built = buildActionCommand(body, base);
    if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });
    const ref = await commands.add(clean(doc(built.command)));
    return NextResponse.json({ ok: true, id: ref.id });
}
