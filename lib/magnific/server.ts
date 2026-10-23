/**
 * lib/magnific/server.ts
 *
 * Il collegamento vero a Magnific, solo lato server: la chiave MAGNIFIC_API_KEY non arriva mai al browser. Ogni operazione
 * consuma crediti, quindi c'è un tetto giornaliero per utente (MAGNIFIC_DAILY_LIMIT, 25 di partenza). Le immagini
 * prodotte si salvano nel nostro archivio: gli indirizzi di Magnific possono scadere.
 */
import crypto from 'crypto';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { MAGNIFIC_BASE, describeHttpError, extensionFor, isSafeRemoteUrl, nextCount, normalizeTask, parseLimit, usageKey, type MagnificTask } from './core';

export class MagnificError extends Error {
    constructor(message: string, public status = 502) { super(message); }
}

export const isConfigured = () => !!process.env.MAGNIFIC_API_KEY;

async function request(path: string, init: { method: 'GET' | 'POST'; json?: unknown; form?: Record<string, string> }): Promise<any> {
    const key = process.env.MAGNIFIC_API_KEY;
    if (!key) throw new MagnificError('Magnific non è configurato.', 503);
    const headers: Record<string, string> = { 'x-magnific-api-key': key, Accept: 'application/json' };
    let body: string | undefined;
    if (init.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(init.json); }
    if (init.form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(init.form).toString(); }
    const res = await fetch(`${MAGNIFIC_BASE}${path}`, { method: init.method, headers, body, cache: 'no-store', signal: AbortSignal.timeout(50_000) });
    if (!res.ok) {
        console.error(`[magnific] ${init.method} ${path} → ${res.status}`, (await res.text().catch(() => '')).slice(0, 300));
        throw new MagnificError(describeHttpError(res.status), res.status === 429 ? 429 : 502);
    }
    return res.json();
}

export async function createImageTask(body: Record<string, unknown>): Promise<MagnificTask> {
    const task = normalizeTask(await request('/v1/ai/mystic', { method: 'POST', json: body }));
    if (!task) throw new MagnificError('Risposta di Magnific non riconosciuta.');
    return task;
}

export async function readImageTask(taskId: string): Promise<MagnificTask> {
    // Il numero dell'operazione finisce in un indirizzo: solo caratteri da identificativo
    if (!/^[A-Za-z0-9-]{8,64}$/.test(taskId)) throw new MagnificError('Operazione non valida.', 400);
    const task = normalizeTask(await request(`/v1/ai/mystic/${taskId}`, { method: 'GET' }));
    if (!task) throw new MagnificError('Risposta di Magnific non riconosciuta.');
    return task;
}

/** Rimuove lo sfondo (risposta immediata). Restituisce l'indirizzo del PNG con trasparenza. */
export async function removeBackground(imageUrl: string): Promise<string> {
    const json = await request('/v1/ai/beta/remove-background', { method: 'POST', form: { image_url: imageUrl } });
    const url = json?.high_resolution || json?.url || json?.data?.url || json?.preview;
    if (typeof url !== 'string' || !isSafeRemoteUrl(url)) throw new MagnificError('Magnific non ha restituito un\'immagine.');
    return url;
}

/**
 * Tetto giornaliero: un contatore per utente e per giorno, aggiornato in transazione. Lancia se è raggiunto.
 * Restituisce quante operazioni restano oggi.
 */
export async function consumeDaily(uid: string): Promise<{ used: number; limit: number }> {
    const limit = parseLimit(process.env.MAGNIFIC_DAILY_LIMIT);
    const ref = adminDb.collection('magnificUsage').doc(usageKey(uid, new Date()));
    const used = await adminDb.runTransaction(async (tx) => {
        const current = ((await tx.get(ref)).data()?.count as number) || 0;
        const next = nextCount(current, limit);
        if (next === null) return null;
        tx.set(ref, { uid, count: next, updatedAt: new Date().toISOString() }, { merge: true });
        return next;
    });
    if (used === null) throw new MagnificError(`Hai raggiunto il limite di ${limit} operazioni AI di oggi: si riparte domani.`, 429);
    return { used, limit };
}

/**
 * Scarica un'immagine da un indirizzo (https, dominio vero, max 25 MB, solo immagini) e la salva nel nostro archivio.
 * `name` rende l'operazione ripetibile: se il file c'è già si riusa, senza ricaricarlo.
 */
export async function persistImage(remoteUrl: string, name: string): Promise<string> {
    if (!isSafeRemoteUrl(remoteUrl)) throw new MagnificError('Indirizzo dell\'immagine non consentito.');
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucketName) throw new MagnificError('Archivio non configurato.', 503);

    const res = await fetch(remoteUrl, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new MagnificError('Non riesco a scaricare l\'immagine prodotta.');
    const type = res.headers.get('content-type') || '';
    if (!/^image\//i.test(type)) throw new MagnificError('Il file prodotto non è un\'immagine.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 25 * 1024 * 1024) throw new MagnificError('Immagine troppo grande.');

    // Il nome viene anche da risposte esterne: solo caratteri sicuri
    const safe = name.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 120) || crypto.randomUUID();
    const path = `editorial-plan/story-ai/${safe}.${extensionFor(type)}`;
    const file = adminStorage.bucket(bucketName).file(path);
    const [exists] = await file.exists();
    let token: string;
    if (exists) {
        const [meta] = await file.getMetadata();
        token = String(meta.metadata?.firebaseStorageDownloadTokens || '').split(',')[0];
        if (token) return downloadUrl(bucketName, path, token);
    }
    token = crypto.randomUUID();
    await file.save(buf, { contentType: type, metadata: { metadata: { firebaseStorageDownloadTokens: token } }, resumable: false });
    return downloadUrl(bucketName, path, token);
}

const downloadUrl = (bucket: string, path: string, token: string) =>
    `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
