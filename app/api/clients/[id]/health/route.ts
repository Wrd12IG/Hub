import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, denyUnlessClientAllowed, getClientToken } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getClientMarketingReport, buildWindows } from '@/lib/reporting';
import { getGoogleAdsCompetitivePressure } from '@/lib/google-ads-client';
import { computeClientHealth, type ClientHealth, type PressureSummary } from '@/lib/client-health';
import type { Client } from '@/lib/data';

// Il verdetto richiede il report su due finestre (corrente e precedente), che
// significa il doppio delle chiamate alle piattaforme. Il tetto per singola
// piattaforma sta in lib/reporting.ts; questo è quello complessivo.
export const maxDuration = 60;

/**
 * Finestra fissa, deliberatamente indipendente dal selettore "Periodo" della
 * pagina: il badge sta accanto al nome del cliente e deve significare sempre la
 * stessa cosa. Un badge che cambia verdetto quando cambi il menù a tendina non
 * è un verdetto, è un grafico.
 */
const DAYS = 30;

/** Quanto resta valido un verdetto in cache. */
const TTL_MS = 6 * 60 * 60 * 1000;

function isoDaysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
}

/**
 * GET /api/clients/[id]/health
 *
 * Come sta andando questo cliente, in una faccia e un numero. Vedi
 * lib/client-health.ts per il perché il voto guarda solo il risultato e non la
 * media dei quattro segnali.
 *
 * Il calcolo costa (due finestre di report su tutte le piattaforme collegate),
 * quindi il risultato vive in cache 6 ore su clients/{id}/cache/health.
 * `?refresh=1` la scavalca.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    const denied = await denyUnlessClientAllowed(auth.uid, params.id);
    if (denied) return denied;

    const clientId = params.id;
    const cacheRef = adminDb.collection('clients').doc(clientId).collection('cache').doc('health');
    const refresh = request.nextUrl.searchParams.get('refresh') === '1';

    if (!refresh) {
        const cached = await cacheRef.get().catch(() => null);
        const data = cached?.exists ? (cached.data() as any) : null;
        if (data?.computedAt && Date.now() - Date.parse(data.computedAt) < TTL_MS) {
            return NextResponse.json({ ...(data.health as ClientHealth), computedAt: data.computedAt, cached: true });
        }
    }

    const clientSnap = await adminDb.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    const client = clientSnap.data() as Client & {
        lastSeoScore?: number;
        lastSeoAuditAt?: string;
        googleAdAccountId?: string;
    };

    try {
        const klaviyoToken = await getClientToken(clientId, 'klaviyo').catch(() => null);
        const klaviyo = klaviyoToken?.accessToken
            ? {
                  apiKey: klaviyoToken.accessToken,
                  conversionMetricId: klaviyoToken.extra?.conversionMetricId,
                  cacheKey: clientId,
              }
            : undefined;

        // La pressione competitiva è un extra: se Google Ads non risponde il
        // verdetto si dà comunque, senza quella causa. Non deve mai essere lei
        // a far fallire il badge.
        const pressurePromise: Promise<PressureSummary | null> = client.googleAdAccountId
            ? getGoogleAdsCompetitivePressure(client.googleAdAccountId, isoDaysAgo(DAYS), isoDaysAgo(0))
                  .then((p) => ({
                      impressionShare: p.impressionShare,
                      rankLost: p.rankLost,
                      budgetLost: p.budgetLost,
                      diagnosi: p.diagnosi,
                  }))
                  .catch((err: any) => {
                      console.error(`[health] pressione competitiva non disponibile per ${clientId}:`, err.message);
                      return null;
                  })
            : Promise.resolve(null);

        const [platforms, pressure] = await Promise.all([
            getClientMarketingReport({ ...client, klaviyo }, 'last_30d', buildWindows(DAYS, 'prev_period')),
            pressurePromise,
        ]);

        const health = computeClientHealth({
            platforms,
            days: DAYS,
            seoScore: typeof client.lastSeoScore === 'number' ? client.lastSeoScore : null,
            seoAuditAt: client.lastSeoAuditAt ?? null,
            pressure,
        });

        const computedAt = new Date().toISOString();
        // Un errore di scrittura sulla cache non deve togliere all'utente un
        // verdetto già calcolato.
        await cacheRef.set({ computedAt, days: DAYS, health }).catch((err: any) => {
            console.error(`[health] cache non scritta per ${clientId}:`, err.message);
        });

        return NextResponse.json({ ...health, computedAt, cached: false });
    } catch (err: any) {
        console.error(`[health] calcolo fallito per ${clientId}:`, err.message);
        return NextResponse.json({ error: err.message }, { status: 503 });
    }
}
