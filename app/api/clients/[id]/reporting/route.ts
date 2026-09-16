import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyAuth, unauthorizedResponse, forbiddenResponse, getAppUser, isStaffUser, ownsClientResource } from '@/lib/api-auth';
import { getClientMarketingReport, buildWindows, type CompareMode, type PlatformReport } from '@/lib/reporting';
import { getClientToken } from '@/lib/api-auth';
import type { Client } from '@/lib/data';

// Il report interroga più piattaforme insieme e alcune sono lente (Google Ads
// su Windsor risponde in ~13s, misurato). Senza un tetto esplicito Vercel usa
// il default e uccide la richiesta a metà: il client non riceve una risposta
// parziale, non ne riceve nessuna. Il limite per singola piattaforma sta in
// lib/reporting.ts; questo è il tetto complessivo.
export const maxDuration = 60;

/**
 * Quanto resta valido un report in cache.
 *
 * Misurato su Windsor: linkedin_organic 15,0s, google_my_business 11,4s per
 * sede (e le sedi vanno in sequenza, perché Windsor le rifiuta in parallelo),
 * facebook 10,6s. Il report gira le piattaforme in parallelo, quindi il totale
 * è dettato dalla più lenta — e su un cliente con 4 sedi GBP si arriva a ~46s
 * di sola GBP, vicino al limite di 60s della funzione.
 *
 * ⚠️ Un report con una piattaforma in errore NON va tenuto sei ore: l'utente
 * si vedrebbe lo stesso errore transitorio per tutta la giornata, senza
 * capire perché "Aggiorna" non cambia nulla. In quel caso la cache dura
 * quindici minuti: abbastanza per non rimartellare le API a ogni apertura,
 * poco per non incrostare un guasto passeggero.
 *
 * Stessa regola per il report vuoto (nessuna integrazione): appena ne
 * colleghi una vuoi vederla comparire, non aspettare sei ore.
 */
const TTL_OK_MS = 6 * 60 * 60 * 1000;
const TTL_DEGRADED_MS = 15 * 60 * 1000;

/**
 * Una voce di cache per combinazione di periodo e confronto: un report a 7
 * giorni e uno a 90 non sono lo stesso dato, e sovrascriverli a vicenda
 * mostrerebbe il periodo sbagliato.
 */
function cacheKey(datePreset: string, days: string, compare: CompareMode): string {
  return `report_${datePreset}_${days}_${compare}`.replace(/[^A-Za-z0-9_-]/g, '');
}

/**
 * ⚠️ Firestore rifiuta i valori `undefined` e questo progetto non ha
 * `ignoreUndefinedProperties`. `fetchOne` in lib/reporting.ts assegna
 * `accountLabel: … || undefined` in modo esplicito, quindi scrivere il report
 * così com'è farebbe fallire ogni scrittura in cache — in silenzio, perché la
 * .catch qui sotto non deve far cadere una risposta già calcolata. Il
 * risultato sarebbe una cache che non memorizza mai niente e nessuno che se
 * ne accorge.
 *
 * Il giro da JSON toglie le proprietà undefined (JSON.stringify le omette) e
 * ha un effetto collaterale utile: quello che finisce in cache è esattamente
 * ciò che il client riceverebbe via HTTP, quindi la copia cachata e quella
 * fresca non possono divergere di forma.
 *
 * Non si cambia `ignoreUndefinedProperties` a livello globale per risolvere un
 * caso locale: renderebbe silenziose tutte le scritture sbagliate del
 * progetto, non solo questa.
 */
function forFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function ttlFor(platforms: PlatformReport[]): number {
  if (platforms.length === 0) return TTL_DEGRADED_MS;
  return platforms.some((p) => !p.connected) ? TTL_DEGRADED_MS : TTL_OK_MS;
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await verifyAuth(request as import('next/server').NextRequest);
  if (!auth) return unauthorizedResponse();

  const clientId = params.id;

  // Authorization: staff can view any client's report; a "Cliente"-role user can
  // only view the report for their own client — this exposes real ad-spend/
  // performance data, so ownership matters here even where an older route
  // (GET /api/clients/[id]) currently doesn't check it.
  const user = await getAppUser(auth.uid);
  if (!isStaffUser(user) && !ownsClientResource(user, clientId)) return forbiddenResponse();

  try {
    const clientSnap = await adminDb.collection('clients').doc(clientId).get();
    if (!clientSnap.exists) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }
    const client = clientSnap.data() as Client;

    const { searchParams } = new URL(request.url);
    const datePreset = searchParams.get('date_preset') || 'last_30d';
    const daysRaw = searchParams.get('days') || '';
    const days = parseInt(daysRaw, 10);
    const compare = (searchParams.get('compare') || 'none') as CompareMode;
    const refresh = searchParams.get('refresh') === '1';

    const cacheRef = adminDb
      .collection('clients').doc(clientId)
      .collection('cache').doc(cacheKey(datePreset, daysRaw, compare));

    if (!refresh) {
      const cached = await cacheRef.get().catch(() => null);
      const hit = cached?.exists ? (cached.data() as any) : null;
      if (hit?.computedAt && Date.now() - Date.parse(hit.computedAt) < (hit.ttlMs ?? TTL_OK_MS)) {
        return NextResponse.json({
          clientId, datePreset, compare,
          windows: hit.windows ?? null,
          platforms: hit.platforms as PlatformReport[],
          computedAt: hit.computedAt,
          cached: true,
        });
      }
    }

    // Explicit windows are only needed for a comparison; without one the
    // simpler date_preset path is kept.
    const windows = Number.isFinite(days) && compare !== 'none'
        ? buildWindows(days, compare)
        : undefined;

    // La chiave Klaviyo vive cifrata nella sottocollection `integrations`, non
    // sul documento del cliente: la si risolve qui e la si passa, così
    // lib/reporting.ts resta senza dipendenze da Firestore. Un errore nel
    // leggerla non deve far cadere tutto il resto del report.
    const klaviyoToken = await getClientToken(clientId, 'klaviyo').catch(() => null);
    const klaviyo = klaviyoToken?.accessToken
      ? {
          apiKey: klaviyoToken.accessToken,
          conversionMetricId: klaviyoToken.extra?.conversionMetricId,
          // Chiave di cache: l'endpoint dei report Klaviyo accetta 2 richieste
          // al minuto, quindi senza cache la scheda sarebbe in errore quasi
          // sempre. Vedi lib/klaviyo-client.ts.
          cacheKey: clientId,
        }
      : undefined;

    const report = await getClientMarketingReport({ ...client, klaviyo }, datePreset, windows);

    const computedAt = new Date().toISOString();
    // Un errore di scrittura sulla cache non deve togliere all'utente un
    // report già calcolato.
    await cacheRef
      .set(forFirestore({ computedAt, ttlMs: ttlFor(report), windows: windows ?? null, platforms: report }))
      .catch((err: any) => {
        console.error(`[reporting] cache non scritta per ${clientId}:`, err.message);
      });

    return NextResponse.json({
      clientId, datePreset, compare,
      windows: windows ?? null,
      platforms: report,
      computedAt,
      cached: false,
    });
  } catch (error: any) {
    console.error(`[reporting] Error building report for client ${clientId}:`, error);
    return NextResponse.json({ error: 'Failed to build marketing report' }, { status: 500 });
  }
}
