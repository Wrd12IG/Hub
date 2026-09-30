import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, getAppUser, isStaffUser, ownsClientResource } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import type { HealthState } from '@/lib/client-health';

// Legge gli header, quindi non è prerenderizzabile. Vedi PR #50.
export const dynamic = 'force-dynamic';

/**
 * GET /api/clients/health
 *
 * I verdetti già calcolati per tutti i clienti, per il badge nella lista.
 *
 * ⚠️ Questa route NON calcola mai. Legge solo ciò che è in cache e per il
 * resto risponde `cached: false`. Calcolare il verdetto di sessanta clienti
 * significherebbe interrogare GA4, Google Ads, Klaviyo e Awin su due finestre
 * ciascuno: minuti di attesa per aprire un elenco, e un carico sulle API che
 * nessuno ha chiesto. La cache la riempie chi apre la pagina di un cliente
 * (/api/clients/[id]/health) o il suo "Ricalcola".
 *
 * Conseguenza voluta: un cliente mai aperto da sei ore non ha faccia. Meglio
 * un buco dichiarato che un elenco che si carica in tre minuti.
 */

/** Solo i campi che serve mostrare: le `reasons` in lista non si leggono. */
const FIELDS = ['computedAt', 'health.state', 'health.deltaPct', 'health.deltaAbs', 'health.deltaKind', 'health.metricLabel'];

interface Row {
    clientId: string;
    state: HealthState | null;
    deltaPct: number | null;
    deltaAbs: number | null;
    deltaKind: 'pct' | 'abs' | null;
    metricLabel: string | null;
    computedAt: string | null;
    cached: boolean;
}

export async function GET(request: NextRequest) {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const user = await getAppUser(auth.uid);
    const staff = isStaffUser(user);

    try {
        const clientsSnap = await adminDb.collection('clients').select().get();
        const ids = clientsSnap.docs
            .map((d) => d.id)
            // Un utente con ruolo Cliente vede solo il proprio: questi sono
            // dati di andamento, non un elenco di nomi.
            .filter((id) => staff || ownsClientResource(user, id));

        if (ids.length === 0) return NextResponse.json({ clients: [] });

        // getAll legge fino a sessanta documenti in un solo giro invece di
        // sessanta letture in sequenza, e il fieldMask evita di tirarsi
        // dietro le `reasons` che in lista non servono.
        const refs = ids.map((id) => adminDb.collection('clients').doc(id).collection('cache').doc('health'));
        const snaps = await adminDb.getAll(...refs, { fieldMask: FIELDS });

        const clients: Row[] = snaps.map((snap, i) => {
            const data = snap.exists ? (snap.data() as any) : null;
            const h = data?.health ?? null;
            return {
                clientId: ids[i],
                state: h?.state ?? null,
                deltaPct: h?.deltaPct ?? null,
                deltaAbs: h?.deltaAbs ?? null,
                deltaKind: h?.deltaKind ?? null,
                metricLabel: h?.metricLabel ?? null,
                computedAt: data?.computedAt ?? null,
                cached: !!h?.state,
            };
        });

        return NextResponse.json({ clients });
    } catch (err: any) {
        console.error('[clients/health] lettura fallita:', err.message);
        return NextResponse.json({ error: err.message }, { status: 503 });
    }
}
