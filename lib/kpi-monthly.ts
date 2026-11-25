/**
 * lib/kpi-monthly.ts
 *
 * Legge le piattaforme di UN cliente per UN mese e ne ricava i KPI (lib/kpi-compute.ts), salvandone la «fotografia» su
 * Firestore. La mail del giorno 3 non rifà le letture: usa le fotografie, così un guasto di Windsor la mattina dell'invio
 * non la ferma e ogni cliente si calcola con la sua calma (una chiamata per cliente, entro i 60 secondi di Vercel).
 *
 * Tre finestre: il mese, il mese prima (nella stessa chiamata del report: `previous`) e lo stesso mese dell'anno scorso
 * (una chiamata a parte, senza confronto). Si leggono SOLO le piattaforme che servono ai KPI scelti per quel cliente:
 * una concessionaria con i KPI di default non scarica Klaviyo né LinkedIn, che sono le più lente e le più limitate.
 */

import { adminDb } from './firebase-admin';
import { getClientToken } from './api-auth';
import { getClientMarketingReport } from './reporting';
import { computeClientMonthly, platformsNeeded, shiftMonth, SOURCE_NAMES, type ClientMonthly } from './kpi-compute';
import { isKpiProfile, kpiIdsForClient } from './kpi-profiles';
import { isMonthKey } from './manual-kpis';
import { readKpiOverrides } from './kpi-profiles-store';
import { readManualKpis, writeSnapshot } from './monthly-mail-store';
import { completedBlocks, computeWeeks, monthWindows, weekComparison, type WeekInput } from './kpi-weekly';
import { romeDateKey } from './monthly-mail-run';

/** Quante settimane si leggono insieme per un cliente: le fonti (Klaviyo in testa) hanno limiti di chiamate. */
const WEEK_CONCURRENCY = 2;

export type MonthlyOutcome =
    | { ok: true; result: ClientMonthly }
    | { ok: false; reason: 'not_found' | 'no_profile' | 'bad_month'; message: string };

export interface MonthOptions {
    /** Elenco di KPI al posto di quello del cliente (la pagina «KPI concessionario» ne mostra più di 5). */
    kpiIds?: string[];
    /** Settimana su settimana (di default sì: serve alla mail). */
    weeks?: boolean;
    /** Salva la fotografia per la mail (di default sì). Chi guarda soltanto non deve sovrascriverla. */
    snapshot?: boolean;
}

export async function computeClientMonth(clientId: string, month: string, opts: MonthOptions = {}): Promise<MonthlyOutcome> {
    const { weeks: withWeeks = true, snapshot = true } = opts;
    if (!isMonthKey(month)) return { ok: false, reason: 'bad_month', message: 'Mese non valido.' };
    const today = romeDateKey(new Date());
    const windows = monthWindows(month, today);
    if (!windows) return { ok: false, reason: 'bad_month', message: 'Il mese non è ancora iniziato: serve almeno un giorno chiuso.' };

    const snap = await adminDb.collection('clients').doc(clientId).get();
    if (!snap.exists) return { ok: false, reason: 'not_found', message: 'Cliente non trovato.' };
    const client = snap.data() as Record<string, any>;
    if (!isKpiProfile(client.kpiProfile)) return { ok: false, reason: 'no_profile', message: 'Il cliente non ha un profilo KPI.' };

    const overrides = await readKpiOverrides();
    const kpiIds = opts.kpiIds ?? kpiIdsForClient(client, overrides) ?? [];
    const need = platformsNeeded(kpiIds);

    // Klaviyo sta cifrato a parte: si chiede solo se serve
    let klaviyo: { apiKey: string; conversionMetricId?: string; cacheKey?: string } | undefined;
    if (need.has('klaviyo')) {
        const t = await getClientToken(clientId, 'klaviyo').catch(() => null);
        if (t?.accessToken) klaviyo = { apiKey: t.accessToken, conversionMetricId: t.extra?.conversionMetricId, cacheKey: clientId };
    }

    const w = client.windsorAccounts ?? {};
    const source = {
        metaAdAccountId: need.has('facebook') ? client.metaAdAccountId : undefined,
        metaCampaignFilter: need.has('facebook') ? client.metaCampaignFilter : undefined,
        googleAdAccountId: need.has('google_ads') ? client.googleAdAccountId : undefined,
        ga4PropertyId: need.has('ga4') ? client.ga4PropertyId : undefined,
        awinAdvertiserId: need.has('awin') ? client.awinAdvertiserId : undefined,
        klaviyo,
        windsorAccounts: {
            instagram: need.has('instagram') ? w.instagram : undefined,
            facebook_page: need.has('facebook_page') ? w.facebook_page : undefined,
            linkedin_organic: need.has('linkedin_organic') ? w.linkedin_organic : undefined,
            gbp: need.has('gbp') ? w.gbp : undefined,
            searchconsole: need.has('searchconsole') ? w.searchconsole : undefined,
        },
    };

    const prevMonth = shiftMonth(month, -1);
    const yoyMonth = shiftMonth(month, -12);
    const [main, yoy, manual] = await Promise.all([
        getClientMarketingReport(source, 'last_30d', { current: windows.current, previous: windows.previous }),
        // L'anno scorso: una lettura a parte. Se fallisce non deve far cadere il mese: si perde solo quel confronto.
        getClientMarketingReport(source, 'last_30d', { current: windows.yoy, previous: null }).catch((e: any) => {
            console.error(`[kpi-monthly] ${clientId}: confronto anno scorso non disponibile:`, e?.message);
            return [];
        }),
        // I dati reali sono di mese intero: a mese in corso non si confrontano con i primi giorni (sarebbero grandezze diverse)
        windows.partial
            ? Promise.resolve({ current: undefined, previous: undefined, yoy: undefined })
            : Promise.all([month, prevMonth, yoyMonth].map((m) => readManualKpis([clientId], m).then((r) => r[clientId])))
                .then(([current, previous, yoyV]) => ({ current, previous, yoy: yoyV })),
    ]);

    // Le fonti che dovevano rispondere e non l'hanno fatto: si dicono, non si fanno passare per «zero»
    const failed = Array.from(new Set([...main, ...yoy].filter((p) => !p.connected).map((p) => SOURCE_NAMES[p.platform] ?? p.platform)));

    const result = computeClientMonthly({
        clientId, name: String(client.name ?? clientId), profile: client.kpiProfile, kpiIds, month, main, yoy, manual, failedSources: failed,
    });

    // Settimana su settimana: una lettura per ogni settimana chiusa, con la stessa settimana del mese prima. Una settimana che
    // non si legge non ferma il mese: resta «non disponibile» e il resto si vede.
    const blocks = withWeeks ? completedBlocks(month, today) : [];
    const weekInputs: WeekInput[] = new Array(blocks.length);
    let next = 0;
    const worker = async () => {
        for (let i = next++; i < blocks.length; i = next++) {
            const block = blocks[i];
            const prev = weekComparison(month, block.n);
            const reports = await getClientMarketingReport(source, 'last_30d', { current: block, previous: prev }).catch((e: any) => {
                console.error(`[kpi-monthly] ${clientId}: settimana ${block.n} non disponibile:`, e?.message);
                return null;
            });
            weekInputs[i] = { block, comparable: prev !== null, reports };
        }
    };
    await Promise.all(Array.from({ length: Math.min(WEEK_CONCURRENCY, blocks.length) }, worker));
    if (withWeeks) result.weeks = computeWeeks(kpiIds, weekInputs);
    if (windows.partial) result.partial = { days: windows.days };

    if (snapshot) await writeSnapshot(month, result);
    return { ok: true, result };
}
