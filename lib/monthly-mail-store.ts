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

/* ───────────── registro dell'invio automatico ───────────── */

const runRef = (month: string) => adminDb.collection('monthly_kpi_mail_runs').doc(month);

export interface MailRun {
    /** Quando è partita la mail (assente = non ancora partita). */
    sentAt?: string;
    sentTo?: string[];
    clients?: number;
    /** Clienti lasciati fuori dalla mail perché il calcolo è fallito più volte (nome → errore). */
    skipped?: Record<string, string>;
    /** Tentativi di calcolo falliti per cliente. */
    attempts?: Record<string, number>;
    lastError?: string;
    /** Chi sta spedendo adesso: impedisce a due chiamate ravvicinate di mandare la mail due volte. */
    sendingSince?: string;
}

export async function readMailRun(month: string): Promise<MailRun> {
    const s = await runRef(month).get();
    return s.exists ? (s.data() as MailRun) : {};
}

export async function patchMailRun(month: string, patch: Record<string, unknown>): Promise<void> {
    await runRef(month).set(JSON.parse(JSON.stringify(patch)), { merge: true });
}

export async function bumpAttempt(month: string, clientId: string, error: string): Promise<void> {
    await runRef(month).set({ attempts: { [clientId]: FieldValue.increment(1) }, lastError: error.slice(0, 300) }, { merge: true });
}

/**
 * Prenota l'invio in modo atomico. Vero solo per la prima chiamata: se la mail è già partita (e non è un invio forzato) o un'altra
 * chiamata sta spedendo da meno di 10 minuti, falso. Una prenotazione rimasta appesa oltre i 10 minuti (funzione caduta a metà)
 * si riprende.
 */
export async function claimSend(month: string, force: boolean): Promise<boolean> {
    return adminDb.runTransaction(async (tx) => {
        const snap = await tx.get(runRef(month));
        const d = (snap.exists ? snap.data() : {}) as MailRun;
        if (d.sentAt && !force) return false;
        if (d.sendingSince && Date.now() - new Date(d.sendingSince).getTime() < 10 * 60 * 1000) return false;
        tx.set(runRef(month), { sendingSince: new Date().toISOString() }, { merge: true });
        return true;
    });
}

/** Riparte da zero per un invio forzato: azzera tentativi, errori e il «già inviata» del mese. */
export async function resetMailRun(month: string): Promise<void> {
    await runRef(month).delete();
}
