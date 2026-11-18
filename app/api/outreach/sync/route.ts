/**
 * POST /api/outreach/sync
 *
 * Il ponte di Sellbird manda qui lo stato (email in coda, aziende, contatti, risposte, campagne, segnali, contatori, pausa).
 * Autenticata con OUTREACH_BRIDGE_SECRET. Vedi lib/outreach.ts per come funziona il ponte.
 *
 * Le liste lunghe (email, aziende, contatti, risposte) arrivano a differenza: il ponte manda solo le righe cambiate
 * dall'ultima volta (e tutto, una volta all'ora). Scrivere ogni volta ogni documento costerebbe migliaia di scritture
 * al giorno per niente. Per questo i contatori delle email li manda il ponte (`outboxCounts`, calcolati su tutte le
 * righe) e non si ricavano più dalle righe ricevute.
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import {
    MAX_CAMPAIGNS,
    MAX_COMPANIES,
    MAX_CONTACTS,
    MAX_OUTBOX,
    MAX_REPLIES,
    MAX_SIGNALS,
    denyUnlessBridge,
    parseCampaignItem,
    parseCompanyItem,
    parseContactItem,
    parseCounts,
    parseDiscoverInfo,
    parsePaused,
    parseOutboxItem,
    parseReplyItem,
    parseSignalItem,
    parseStats,
    type OutreachCampaignItem,
    type OutreachCompanyItem,
    type OutreachContactItem,
    type OutreachOutboxItem,
    type OutreachReplyItem,
    type OutreachSignalItem,
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
    const rawContacts: unknown[] = Array.isArray(body?.contacts) ? body.contacts : [];
    const rawCampaigns: unknown[] = Array.isArray(body?.campaigns) ? body.campaigns : [];
    const rawSignals: unknown[] = Array.isArray(body?.signals) ? body.signals : [];
    if (
        rawOutbox.length > MAX_OUTBOX || rawCompanies.length > MAX_COMPANIES || rawReplies.length > MAX_REPLIES ||
        rawContacts.length > MAX_CONTACTS || rawCampaigns.length > MAX_CAMPAIGNS || rawSignals.length > MAX_SIGNALS
    ) {
        return NextResponse.json({ error: 'Fotografia troppo grande' }, { status: 413 });
    }

    const outbox = rawOutbox.map(parseOutboxItem).filter((x): x is OutreachOutboxItem => x !== null);
    const companies = rawCompanies.map(parseCompanyItem).filter((x): x is OutreachCompanyItem => x !== null);
    const replies = rawReplies.map(parseReplyItem).filter((x): x is OutreachReplyItem => x !== null);

    const contacts = rawContacts.map(parseContactItem).filter((x): x is OutreachContactItem => x !== null);
    const campaigns = rawCampaigns.map(parseCampaignItem).filter((x): x is OutreachCampaignItem => x !== null);
    const signals = rawSignals.map(parseSignalItem).filter((x): x is OutreachSignalItem => x !== null);

    // Con il ponte vecchio (fotografia intera) i contatori si ricavano dalle righe; con quello nuovo li manda lui.
    let counts = parseCounts(body?.outboxCounts);
    if (!body?.outboxCounts) {
        counts = {};
        for (const o of outbox) counts[o.status] = (counts[o.status] ?? 0) + 1;
    }

    await writeAll('outreachOutbox', outbox);
    await writeAll('outreachCompanies', companies);
    await writeAll('outreachReplies', replies);
    await writeAll('outreachContacts', contacts);
    await adminDb.collection('outreachMeta').doc('current').set({
        syncedAt: new Date().toISOString(),
        outboxCounts: counts,
        companies: companies.length,
        stats: parseStats(body?.stats),
        campaigns,
        signals,
        discover: parseDiscoverInfo(body?.discover),
        sendingPaused: parsePaused(body?.sendingPaused),
    });

    return NextResponse.json({
        ok: true,
        outbox: outbox.length,
        companies: companies.length,
        replies: replies.length,
        contacts: contacts.length,
        skipped:
            rawOutbox.length - outbox.length + (rawCompanies.length - companies.length) + (rawReplies.length - replies.length) +
            (rawContacts.length - contacts.length) + (rawCampaigns.length - campaigns.length) + (rawSignals.length - signals.length),
    });
}
