import { adminDb } from './firebase-admin';
import type { PlatformReport } from './reporting';

// Cache del report per la pagina pubblica.
//
// 1. Se lo staff ha già aperto la Panoramica con lo stesso periodo, la sua voce (`report4_…`, scritta da
//    app/api/clients/[id]/reporting/route.ts — la chiave deve restare uguale a `cacheKey` di quel file) è buona anche qui.
// 2. Altrimenti si legge/scrive una voce propria, `share1_…`: il report della pagina pubblica è RISTRETTO ai canali
//    mostrati al cliente, e scriverlo sotto la chiave dello staff gli toglierebbe le altre piattaforme.

const TTL_OK_MS = 6 * 60 * 60 * 1000;
const TTL_DEGRADED_MS = 2 * 60 * 1000;

const preset = (days: number) => `last_${days}d`;
export const staffKey = (days: number) => `report4_${preset(days)}_${days}_prev_period`;
export const shareKey = (days: number) => `share1_${preset(days)}_${days}_prev_period`;

export const ttlFor = (platforms: PlatformReport[]) =>
    platforms.length === 0 || platforms.some((p) => !p.connected) ? TTL_DEGRADED_MS : TTL_OK_MS;

async function readFresh(clientId: string, key: string): Promise<{ platforms: PlatformReport[]; computedAt: string } | null> {
    const snap = await adminDb.collection('clients').doc(clientId).collection('cache').doc(key).get().catch(() => null);
    const hit = snap?.exists ? (snap.data() as any) : null;
    if (!hit?.computedAt || !Array.isArray(hit.platforms)) return null;
    if (Date.now() - Date.parse(hit.computedAt) >= (hit.ttlMs ?? TTL_OK_MS)) return null;
    return { platforms: hit.platforms as PlatformReport[], computedAt: hit.computedAt };
}

export async function readCachedReport(clientId: string, days: number) {
    return (await readFresh(clientId, staffKey(days))) ?? (await readFresh(clientId, shareKey(days)));
}

export async function writeShareReport(clientId: string, days: number, platforms: PlatformReport[]): Promise<string> {
    const computedAt = new Date().toISOString();
    // Firestore rifiuta gli undefined: il giro da JSON li toglie (vedi forFirestore nella route dello staff).
    await adminDb.collection('clients').doc(clientId).collection('cache').doc(shareKey(days))
        .set(JSON.parse(JSON.stringify({ computedAt, ttlMs: ttlFor(platforms), platforms })))
        .catch((e: any) => console.error('[share-report] cache non scritta:', e.message));
    return computedAt;
}
