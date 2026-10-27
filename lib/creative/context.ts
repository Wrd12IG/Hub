/**
 * lib/creative/context.ts  (solo server)
 * I dati del cliente che servono ai generatori: profilo social (settore, tono, pubblico, cose da evitare) e gli ultimi
 * argomenti già nel piano editoriale, per non ripeterli. Condiviso da Creative Lab e Piano PED.
 */
import { adminDb } from '@/lib/firebase-admin';
import type { ClientContext } from './playbooks';

export async function loadClientContext(clientId: string): Promise<{ ctx: ClientContext; usedProfile: boolean } | null> {
    const snap = await adminDb.collection('clients').doc(clientId).get();
    if (!snap.exists) return null;
    const c = snap.data() as Record<string, any>;
    const profile = (c.socialProfile || {}) as Record<string, string>;
    let recentTopics: string[] = [];
    try {
        const peds = await adminDb.collection('editorialContents').where('clientId', '==', clientId).limit(40).get();
        recentTopics = peds.docs
            .map((d) => ({ topic: String(d.data().topic || ''), date: String(d.data().publicationDate || '') }))
            .filter((x) => x.topic)
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 10)
            .map((x) => x.topic.slice(0, 80));
    } catch (e) {
        console.warn('[creative] PED non letto:', (e as Error)?.message);
    }
    return {
        usedProfile: !!(profile.toneOfVoice || profile.sector || profile.targetAudience),
        ctx: {
            name: String(c.name || 'Cliente'),
            sector: profile.sector,
            toneOfVoice: profile.toneOfVoice,
            targetAudience: profile.targetAudience,
            thingsToAvoid: profile.thingsToAvoid,
            aiInfo: profile.aiInfo,
            recentTopics,
        },
    };
}
