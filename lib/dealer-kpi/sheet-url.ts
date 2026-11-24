/**
 * lib/dealer-kpi/sheet-url.ts
 *
 * Dall'indirizzo dello Sheet (o dal solo identificativo) all'identificativo, controllato. Così nessun testo arbitrario finisce nella chiamata a Google.
 */
const ID_RE = /^[A-Za-z0-9_-]{25,100}$/;

export function extractSpreadsheetId(input: string): string | null {
    const s = (input || '').trim();
    if (!s) return null;
    const m = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)/.exec(s);
    const id = m ? m[1] : s;
    return ID_RE.test(id) ? id : null;
}

/** Nome della scheda: lettere, numeri, spazi e pochi segni. Niente virgolette né apici: finisce dentro un intervallo come 'Dati'!A:E. */
export function validTabName(name: string): boolean {
    return /^[A-Za-z0-9\u00C0-\u00FF _.-]{1,60}$/.test((name || '').trim());
}
