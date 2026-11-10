import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { sanitizeOverrides, validateKpiSelection, type KpiOverrides, type KpiProfile } from '@/lib/kpi-profiles';

const ref = () => adminDb.collection('settings').doc('kpiProfiles');

/** Le scelte dell'agenzia sui KPI di ogni profilo (settings/kpiProfiles). Nessun documento = tutti i predefiniti. */
export async function readKpiOverrides(): Promise<KpiOverrides> {
    const snap = await ref().get();
    return snap.exists ? sanitizeOverrides(snap.data()) : {};
}

/**
 * Salva i KPI di UN profilo (`kpis`), o torna al predefinito (`null`). Aggiorna solo quel profilo: due persone che
 * modificano profili diversi non si sovrascrivono. Restituisce lo stato aggiornato.
 */
export async function writeKpiOverride(profile: KpiProfile, kpis: string[] | null): Promise<KpiOverrides> {
    if (kpis === null) {
        await ref().set({ [profile]: FieldValue.delete() }, { merge: true });
    } else {
        const v = validateKpiSelection(kpis);
        if (!v.ok) throw new Error(v.error);
        await ref().set({ [profile]: v.ids }, { merge: true });
    }
    return readKpiOverrides();
}
