/**
 * POST /api/outreach/sync
 *
 * Il ponte di Sellbird manda qui la fotografia dello stato (email in coda, aziende, risposte, contatori, pausa).
 * Autenticata con OUTREACH_BRIDGE_SECRET. Vedi lib/outreach.ts per come funziona il ponte.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
    MAX_COMPANIES,
    MAX_OUTBOX,
    MAX_REPLIES,
    denyUnlessBridge,
    parseCompanyItem,
    parsePaused,
    parseOutboxItem,
    parseReplyItem,
    parseStats,
    type OutreachCompanyItem,
    type OutreachOutboxItem,
    type OutreachReplyItem,
} from '@/lib/outreach';

export const dynamic = 'force-dynamic';

const BATCH = 400;

async function writeAll<T extends { id: string }>(collection: string, items: T[]) {
    for (let i = 0; i < items.length; i += BATCH) {
        const batch = adminDb.batch();
        for (const item of items.slice(i, i + BATCH)) {
            batch.set(adminDb.collection(collection).doc(item.id), item);
        }
        await batch.commit();
    }
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

    const rawOutbox: unknown[] = Array.isArray(body?.outbox) ? body.outbox : [];
    const rawCompanies: unknown[] = Array.isArray(body?.companies) ? body.companies : [];
    const rawReplies: unknown[] = Array.isArray(body?.replies) ? body.replies : [];
    if (rawOutbox.length > MAX_OUTBOX || rawCompanies.length > MAX_COMPANIES || rawReplies.length > MAX_REPLIES) {
        return NextResponse.json({ error: 'Fotografia troppo grande' }, { status: 413 });
    }

    const outbox = rawOutbox.map(parseOutboxItem).filter((x): x is OutreachOutboxItem => x !== null);
    const companies = rawCompanies.map(parseCompanyItem).filter((x): x is OutreachCompanyItem => x !== null);
    const replies = rawReplies.map(parseReplyItem).filter((x): x is OutreachReplyItem => x !== null);

    const counts: Record<string, number> = {};
    for (const o of outbox) counts[o.status] = (counts[o.status] ?? 0) + 1;

    await writeAll('outreachOutbox', outbox);
    await writeAll('outreachCompanies', companies);
    await writeAll('outreachReplies', replies);
    await adminDb.collection('outreachMeta').doc('current').set({
        syncedAt: new Date().toISOString(),
        outboxCounts: counts,
        companies: companies.length,
        stats: parseStats(body?.stats),
        sendingPaused: parsePaused(body?.sendingPaused),
    });

    return NextResponse.json({
        ok: true,
        outbox: outbox.length,
        companies: companies.length,
        replies: replies.length,
        skipped: rawOutbox.length - outbox.length + (rawCompanies.length - companies.length) + (rawReplies.length - replies.length),
    });
}
