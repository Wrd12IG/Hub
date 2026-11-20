/**
 * lib/outreach-exclusions.ts
 *
 * «Escludi»: mettere un'azienda nella lista «mai contattare» di Sellbird (`compliance.do_not_contact`) con un clic, o toglierla.
 * Sellbird non invia più nulla a un dominio in lista (nemmeno un'email già approvata), e il suo punteggio va a zero.
 *
 * La hub non scrive il file di Sellbird: registra un comando che il ponte applica. Qui si controlla ciò che si può chiedere:
 * un dominio vero, di un'azienda che la hub conosce (per aggiungere), o già in lista (per togliere). Il ponte ricontrolla.
 */

/** Un dominio: etichette di lettere, cifre e trattini, punto, estensione. Niente schema, percorsi, spazi, asterischi. */
export const DOMAIN_RE = /^(?=.{4,100}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
export const MAX_EXCLUSIONS = 500;

export function cleanDomain(raw: unknown): string | null {
    if (typeof raw !== 'string') return null;
    let d = raw.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
    return DOMAIN_RE.test(d) ? d : null;
}

export type ExclusionContext = {
    /** True se la hub conosce un'azienda con questo dominio (letto da outreachCompanies). */
    knownCompany: boolean;
    /** I domini già in «mai contattare», come li ha dichiarati il ponte. */
    exclusions: string[];
};

export type ExclusionCommand = { action: 'dnc_add' | 'dnc_remove'; domain: string };
export type ExclusionResult = { ok: true; command: ExclusionCommand } | { ok: false; error: string; status: number };

const bad = (error: string, status = 400): ExclusionResult => ({ ok: false, error, status });

export function buildExclusionCommand(body: any, ctx: ExclusionContext): ExclusionResult {
    const domain = cleanDomain(body?.domain);
    if (!domain) return bad('Dominio non valido.');
    const listed = ctx.exclusions.includes(domain);

    if (body?.action === 'add') {
        if (listed) return bad('Questo dominio è già in «mai contattare».', 409);
        if (!ctx.knownCompany) return bad('Azienda sconosciuta: si esclude solo un dominio che Sellbird ha trovato.', 404);
        if (ctx.exclusions.length >= MAX_EXCLUSIONS) return bad('Lista «mai contattare» troppo lunga: pulisci quella di Sellbird.', 409);
        return { ok: true, command: { action: 'dnc_add', domain } };
    }
    if (body?.action === 'remove') {
        if (!listed) return bad('Questo dominio non è in «mai contattare» (o la lista non è aggiornata).', 409);
        return { ok: true, command: { action: 'dnc_remove', domain } };
    }
    return bad('action deve essere add o remove.');
}

/** I domini della lista come li manda il ponte: solo domini validi, senza doppioni, nel limite. */
export function parseExclusions(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    const out = new Set<string>();
    for (const item of raw) {
        const d = cleanDomain(item);
        if (d && d === String(item).toLowerCase()) out.add(d);
        if (out.size >= MAX_EXCLUSIONS) break;
    }
    return Array.from(out);
}
