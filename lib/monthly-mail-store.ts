import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase-admin';
import type { ClientMonthly } from '@/lib/kpi-compute';
import { cleanManualValues, isMonthKey, type ManualValues } from '@/lib/manual-kpis';
import { settingsOrDefault, validateMailSettings, type MailSettings } from '@/lib/monthly-mail-settings';

const settingsRef = () => adminDb.collection('settings').doc('monthlyKpiMail');
const manualRef = (clientId: string, month: string) => adminDb.collection('clients').doc(clientId).collection('manual_kpis').doc(month);

/** Destinatari e giorno di invio (settings/monthlyKpiMail). Nessun documento = i valori concordati. */
export async function readMailSettings(): Promise<MailSettings> {
    const snap = await settingsRef().get();
    return settingsOrDefault(snap.exists ? snap.data() : undefined);
}

export async function writeMailSettings(raw: unknown): Promise<MailSettings> {
    const v = validateMailSettings(raw);
    if (!v.ok) throw new Error(v.error);
    await settingsRef().set({ ...v.settings, updatedAt: new Date().toISOString() });
    return v.settings;
}

/**
 * I dati reali di un mese per i clienti indicati: clients/{id}/manual_kpis/{AAAA-MM}. Una lettura sola per tutti i
 * documenti (getAll), non una per cliente. Un cliente senza documento non compare nel risultato.
 */
export async function readManualKpis(clientIds: string[], month: string): Promise<Record<string, Record<string, number>>> {
    if (!isMonthKey(month)) throw new Error('Mese non valido.');
    if (clientIds.length === 0) return {};
    const snaps = await adminDb.getAll(...clientIds.map((id) => manualRef(id, month)));
    const out: Record<string, Record<string, number>> = {};
    snaps.forEach((s, i) => {
        if (!s.exists) return;
        const d = s.data() as Record<string, unknown>;
        const values: Record<string, number> = {};
        for (const [k, v] of Object.entries(d)) if (typeof v === 'number') values[k] = v;
        out[clientIds[i]] = values;
    });
    return out;
}

/**
 * Salva i dati reali di più clienti in un colpo solo. Per ogni cliente: un valore numero lo imposta, `null` lo toglie, un
 * campo non indicato resta com'è. Restituisce i clienti salvati e quelli scartati (id che non esiste o valori non validi).
 */
export async function writeManualKpis(
    month: string,
    entries: Record<string, unknown>,
    updatedBy: string,
): Promise<{ saved: string[]; rejected: { clientId: string; error: string }[] }> {
    if (!isMonthKey(month)) throw new Error('Mese non valido.');
    const ids = Object.keys(entries);
    const rejected: { clientId: string; error: string }[] = [];
    const clean = new Map<string, ManualValues>();
    for (const id of ids) {
        const v = cleanManualValues(entries[id]);
        if (v.ok) clean.set(id, v.values); else rejected.push({ clientId: id, error: v.error });
    }
    const valid = Array.from(clean.keys());
    if (valid.length === 0) return { saved: [], rejected };

    // Un id che non è un cliente non deve creare un documento orfano
    const exist = await adminDb.getAll(...valid.map((id) => adminDb.collection('clients').doc(id)));
    const batch = adminDb.batch();
    const saved: string[] = [];
    exist.forEach((c, i) => {
        const id = valid[i];
        if (!c.exists) { rejected.push({ clientId: id, error: 'Cliente non trovato.' }); return; }
        const patch: Record<string, unknown> = { month, updatedAt: new Date().toISOString(), updatedBy };
        for (const [k, v] of Object.entries(clean.get(id)!)) patch[k] = v === null ? FieldValue.delete() : v;
        batch.set(manualRef(id, month), patch, { merge: true });
        saved.push(id);
    });
    if (saved.length) await batch.commit();
    return { saved, rejected };
}

/* ───────────── fotografie mensili ───────────── */


const snapshotRef = (month: string, clientId: string) =>
    adminDb.collection('monthly_kpi_snapshots').doc(month).collection('clients').doc(clientId);

/**
 * La fotografia dei KPI di un cliente per un mese: quella che la mail legge. Il giro da JSON toglie gli `undefined`, che
 * Firestore rifiuta (questo progetto non ha `ignoreUndefinedProperties`): senza, la scrittura fallirebbe in silenzio.
 */
export async function writeSnapshot(month: string, result: ClientMonthly): Promise<void> {
    await snapshotRef(month, result.clientId).set(JSON.parse(JSON.stringify({ computedAt: new Date().toISOString(), result })));
}

/** Le fotografie di un mese per i clienti indicati, in una lettura sola. Chi non ha fotografia non compare. */
export async function readSnapshots(month: string, clientIds: string[]): Promise<Record<string, { computedAt: string; result: ClientMonthly }>> {
    if (!isMonthKey(month)) throw new Error('Mese non valido.');
    if (clientIds.length === 0) return {};
    const snaps = await adminDb.getAll(...clientIds.map((id) => snapshotRef(month, id)));
    const out: Record<string, { computedAt: string; result: ClientMonthly }> = {};
    snaps.forEach((s, i) => { if (s.exists) out[clientIds[i]] = s.data() as { computedAt: string; result: ClientMonthly }; });
    return out;
}
