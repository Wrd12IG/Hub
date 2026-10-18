import { adminDb } from '@/lib/firebase-admin';
import type { SavedCompetitor } from '@/lib/competitor-discovery';

// I competitor della scheda "AI Intelligence" stanno in UN solo posto: clients/{id}.intelligence.competitors,
// che è ciò che la scheda legge. Prima le route scrivevano in clients/{id}/intelligence/competitors (campo `list`), un altro
// documento, e la scheda non li vedeva mai. Il monitoraggio notturno ha un registro a parte (route /competitors).

export function clientRef(clientId: string) {
    return adminDb.collection('clients').doc(clientId);
}

export async function loadClient(clientId: string) {
    const ref = clientRef(clientId);
    const snap = await ref.get();
    return { ref, exists: snap.exists, data: (snap.exists ? snap.data() : null) as any };
}

export function competitorsOf(clientData: any): SavedCompetitor[] {
    const list = clientData?.intelligence?.competitors;
    return Array.isArray(list) ? list : [];
}

/** Salva l'elenco. JSON round trip: Firestore rifiuta `undefined` e il progetto non ha ignoreUndefinedProperties. */
export async function saveCompetitors(ref: ReturnType<typeof clientRef>, list: SavedCompetitor[], uid: string) {
    await ref.set(JSON.parse(JSON.stringify({
        intelligence: { competitors: list },
        intelligenceUpdatedAt: Date.now(),
        intelligenceUpdatedBy: uid,
    })), { merge: true });
}
