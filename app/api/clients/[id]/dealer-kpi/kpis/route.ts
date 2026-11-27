/**
 * GET /api/clients/[id]/dealer-kpi/kpis?month=AAAA-MM[&fresh=1]  (staff)
 *
 * I KPI di un cliente per un mese, quelli del SUO profilo (lib/kpi-profiles.ts, PROFILE_KPI_GROUPS): per un concessionario
 * sito, Meta Ads, Google Ads, Google Maps, Sheet e costo per lead; per gli altri i canali che di solito usano. Ognuno con il
 * confronto sul mese prima. Il percorso resta «dealer-kpi» per non rompere i vecchi indirizzi.
 *
 * Velocità: la lettura delle piattaforme dura 10-20 s (Windsor 8-12 s a chiamata), quindi il risultato resta in cache su
 * Firestore (clients/{id}/cache/kpi1_…): 15 minuti per il mese in corso, 6 ore per un mese chiuso. La chiave contiene le
 * fonti collegate e l'elenco dei KPI, così cambiare un account in Setup API o un KPI invalida la copia. `fresh=1` (pulsante
 * «Aggiorna» e dopo «Sincronizza ora») rilegge sempre. Il confronto con l'anno scorso non si legge: la pagina non lo mostra.
 * NON salva la fotografia della mail mensile.
 */
import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { denyUnlessStaff, unauthorizedResponse, verifyAuth } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { PROFILE_DEFS, isKpiProfile, kpiGroupsFor, kpiIdsOfGroups } from '@/lib/kpi-profiles';
import { computeClientMonth } from '@/lib/kpi-monthly';
import { isMonthKey } from '@/lib/manual-kpis';
import { sourcesSignature } from '@/lib/report-warm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TTL_PARTIAL_MS = 15 * 60 * 1000;
const TTL_CLOSED_MS = 6 * 60 * 60 * 1000;

function kpiCacheKey(month: string, client: any, kpiIds: string[]): string {
    const sig = createHash('sha1').update(sourcesSignature(client) + '|' + kpiIds.join(',')).digest('hex').slice(0, 12);
    return `kpi1_${month}_${sig}`;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
    const user = await verifyAuth(request);
    if (!user) return unauthorizedResponse();
    const denied = await denyUnlessStaff(user.uid);
    if (denied) return denied;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(params.id)) return NextResponse.json({ error: 'Cliente non valido' }, { status: 400 });
    const month = request.nextUrl.searchParams.get('month');
    if (!isMonthKey(month)) return NextResponse.json({ error: 'Mese non valido (AAAA-MM).' }, { status: 400 });
    const fresh = request.nextUrl.searchParams.get('fresh') === '1';
    try {
        const client = await adminDb.collection('clients').doc(params.id).get();
        if (!client.exists) return NextResponse.json({ error: 'Cliente non trovato.' }, { status: 404 });
        const profile = client.get('kpiProfile');
        // Senza profilo non si sa quali KPI mostrare: lo si dice, con il modo per sceglierlo
        if (!isKpiProfile(profile)) return NextResponse.json({ error: 'Questo cliente non ha un profilo KPI: scegli il tipo di attività da «Mail mensile KPI».', noProfile: true }, { status: 422 });
        const groups = kpiGroupsFor(profile);
        const kpiIds = kpiIdsOfGroups(groups);

        const cacheRef = adminDb.collection('clients').doc(params.id).collection('cache').doc(kpiCacheKey(month, client.data(), kpiIds));
        if (!fresh) {
            const hit = await cacheRef.get().catch(() => null);
            const c = hit?.exists ? (hit.data() as any) : null;
            if (c?.computedAt && Array.isArray(c.kpis) && Date.now() - Date.parse(c.computedAt) < (c.ttlMs ?? TTL_PARTIAL_MS)) {
                return NextResponse.json({ month, profile, profileLabel: PROFILE_DEFS[profile].label, groups, kpis: c.kpis, alerts: c.alerts ?? [], partial: c.partial ?? null, computedAt: c.computedAt, cached: true });
            }
        }

        const out = await computeClientMonth(params.id, month, { kpiIds, weeks: false, snapshot: false, yoy: false });
        if (!out.ok) return NextResponse.json({ error: out.message }, { status: out.reason === 'not_found' ? 404 : 422 });
        const { kpis, alerts, partial } = out.result;
        const computedAt = new Date().toISOString();
        // Una lettura con fonti in errore si tiene poco: al prossimo giro si riprova
        const degraded = alerts.some((a) => a.startsWith('Fonti che non hanno risposto'));
        const ttlMs = degraded ? 2 * 60 * 1000 : partial ? TTL_PARTIAL_MS : TTL_CLOSED_MS;
        // Firestore rifiuta gli undefined: il giro da JSON li toglie
        await cacheRef.set(JSON.parse(JSON.stringify({ computedAt, ttlMs, kpis, alerts, partial: partial ?? null })))
            .catch((e: any) => console.error('[dealer-kpi kpis] cache non scritta:', e?.message));
        return NextResponse.json({ month, profile, profileLabel: PROFILE_DEFS[profile].label, groups, kpis, alerts, partial: partial ?? null, computedAt, cached: false });
    } catch (e) {
        console.error('[dealer-kpi kpis]', e);
        return NextResponse.json({ error: 'Errore nella lettura dei dati' }, { status: 500 });
    }
}
