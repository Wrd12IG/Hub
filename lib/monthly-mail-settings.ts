/**
 * Impostazioni della mail mensile dei KPI: chi la riceve e che giorno parte. Una sola mail con tutti i clienti,
 * a indirizzi decisi dall'agenzia (mai ai clienti, mai a caselle di clienti).
 */

export const DEFAULT_RECIPIENTS = ['roberto@wrdigital.it', 'valentina@wrdigital.it', 'commerciale@wrdigital.it'];
export const DEFAULT_SEND_DAY = 3;
export const MAX_RECIPIENTS = 20;

export interface MailSettings { recipients: string[]; sendDay: number }

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

/** «a@x.it, b@y.it» o uno per riga → elenco pulito (minuscolo, senza doppioni). */
export function splitRecipients(text: string): string[] {
    return Array.from(new Set(String(text ?? '').split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)));
}

/** Valida e normalizza. Il giorno va da 1 a 28 per esistere in ogni mese (il 30 febbraio non c'è). */
export function validateMailSettings(raw: unknown): { ok: true; settings: MailSettings } | { ok: false; error: string } {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Impostazioni non valide.' };
    const { recipients, sendDay } = raw as Record<string, unknown>;
    if (!Array.isArray(recipients) || recipients.some((r) => typeof r !== 'string')) return { ok: false, error: "L'elenco dei destinatari non è valido." };
    const list = Array.from(new Set((recipients as string[]).map((r) => r.trim().toLowerCase()).filter(Boolean)));
    if (list.length === 0) return { ok: false, error: 'Serve almeno un destinatario.' };
    if (list.length > MAX_RECIPIENTS) return { ok: false, error: `Al massimo ${MAX_RECIPIENTS} destinatari.` };
    const bad = list.find((r) => !EMAIL_RE.test(r));
    if (bad) return { ok: false, error: `Indirizzo non valido: ${bad}.` };
    if (typeof sendDay !== 'number' || !Number.isInteger(sendDay) || sendDay < 1 || sendDay > 28) return { ok: false, error: 'Il giorno di invio va da 1 a 28.' };
    return { ok: true, settings: { recipients: list, sendDay } };
}

/** Rilegge da Firestore: un documento assente o rovinato torna ai valori concordati. */
export function settingsOrDefault(raw: unknown): MailSettings {
    const v = validateMailSettings(raw);
    return v.ok ? v.settings : { recipients: [...DEFAULT_RECIPIENTS], sendDay: DEFAULT_SEND_DAY };
}
