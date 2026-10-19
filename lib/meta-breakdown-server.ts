import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getData } from '@/lib/windsor-client';
import { ACTION_FIELDS, ACTION_LABELS, LEAD_ALIAS_FIELD, pickConversionBasis, type BreakdownRow } from '@/lib/meta-breakdown';

/**
 * Lettura e risposta comune alle viste di dettaglio Meta (annunci, pubblico): autenticazione, account del cliente,
 * lettura Windsor della sola scomposizione richiesta (le letture sono lente, 8-20 s, per questo una route per vista).
 */
export async function metaBreakdownResponse(
    request: NextRequest,
    clientId: string,
    opts: { dimensionFields: string[]; build: (rows: any[], basis: string | null) => BreakdownRow[] },
) {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    const denied = await denyUnlessClientAllowed(auth.uid, clientId);
    if (denied) return denied;

    const snap = await adminDb.collection('clients').doc(clientId).get();
    const accountId = snap.exists ? (snap.data() as any)?.metaAdAccountId : null;
    if (!accountId) {
        return NextResponse.json({ rows: [], error: 'Questo cliente non ha un Meta Ad Account ID: inseriscilo in Setup API.' }, { status: 503 });
    }

    const raw = request.nextUrl.searchParams.get('days');
    const days = raw === '7' ? 7 : raw === '90' ? 90 : 30;

    try {
        const data = await getData({
            connector: 'facebook',
            accountId,
            fields: [...opts.dimensionFields, 'spend', 'impressions', 'clicks', 'reach', ...ACTION_FIELDS, LEAD_ALIAS_FIELD, 'account_id'],
            datePreset: `last_${days}d`,
            fresh: request.nextUrl.searchParams.get('refresh') === '1',
        });
        const basis = pickConversionBasis(data);
        return NextResponse.json({
            rows: opts.build(data, basis),
            conversionBasis: basis,
            conversionLabel: basis ? ACTION_LABELS[basis] : null,
            _meta: { source: 'windsor', days },
        });
    } catch (err: any) {
        console.error(`[meta-ads-dettaglio] fallita per ${clientId}:`, err.message);
        return NextResponse.json({ rows: [], error: err.message }, { status: 503 });
    }
}
