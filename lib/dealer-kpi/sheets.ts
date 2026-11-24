/**
 * lib/dealer-kpi/sheets.ts
 *
 * Lettura dello Sheet del cliente con l'account di servizio Google (sola lettura). Ogni Sheet va condiviso, in lettura, con l'indirizzo email
 * dell'account di servizio. Credenziali: GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY, oppure quelle di Analytics
 * (GOOGLE_ANALYTICS_*) se è lo stesso account. `reader` è iniettabile: nei test si usa uno finto, senza rete.
 */
import { google } from 'googleapis';
import { readPrivateKey } from '@/lib/google-private-key';

export type SheetsReader = (spreadsheetId: string, tab: string) => Promise<string[][]>;

export type SheetsErrorCode = 'credenziali' | 'non_condiviso' | 'non_trovato' | 'scheda' | 'quota' | 'api_disattivata' | 'altro';
export class SheetsError extends Error {
    constructor(public code: SheetsErrorCode, message: string) { super(message); }
}

export function serviceAccountEmail(): string | null {
    return process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_ANALYTICS_SERVICE_ACCOUNT_EMAIL || null;
}

function credentials(): { email: string; key: string } {
    const email = serviceAccountEmail();
    const key = readPrivateKey(process.env.GOOGLE_SHEETS_PRIVATE_KEY ? 'GOOGLE_SHEETS_PRIVATE_KEY' : 'GOOGLE_ANALYTICS_PRIVATE_KEY');
    if (!email || !key) throw new SheetsError('credenziali', 'Mancano le credenziali Google per leggere gli Sheet (GOOGLE_SHEETS_* oppure GOOGLE_ANALYTICS_*).');
    return { email, key };
}

export const googleSheetsReader: SheetsReader = async (spreadsheetId, tab) => {
    const { email, key } = credentials();
    const auth = new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
    const sheets = google.sheets({ version: 'v4', auth });
    try {
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${tab}'!A:F`, valueRenderOption: 'FORMATTED_VALUE' });
        return (res.data.values || []).map((r) => r.map((c) => String(c ?? '')));
    } catch (e) {
        throw mapError(e, email, tab);
    }
};

/** Traduce gli errori di Google in messaggi che dicono cosa fare. Esportata per i test. */
export function mapError(e: unknown, email: string | null, tab: string): SheetsError {
    const err = e as { code?: number | string; status?: number; message?: string; errors?: Array<{ reason?: string }> };
    const status = Number(err?.status ?? err?.code);
    const msg = String(err?.message ?? '');
    if (status === 403 && /has not been used|is disabled|accessNotConfigured/i.test(msg)) {
        return new SheetsError('api_disattivata', 'L\'API «Google Sheets» non è attiva nel progetto Google Cloud: va abilitata.');
    }
    if (status === 403 || status === 401) {
        return new SheetsError('non_condiviso', `Lo Sheet non è condiviso con la hub: condividilo in lettura con ${email ?? 'l\'account di servizio'}.`);
    }
    if (status === 404) return new SheetsError('non_trovato', 'Sheet non trovato: controlla l\'indirizzo.');
    if (status === 400 && /unable to parse range|range/i.test(msg)) return new SheetsError('scheda', `Nello Sheet non c'è la scheda «${tab}».`);
    if (status === 429) return new SheetsError('quota', 'Google ha limitato le richieste: riprova tra qualche minuto.');
    return new SheetsError('altro', `Errore nella lettura dello Sheet: ${msg.slice(0, 200) || 'sconosciuto'}`);
}
