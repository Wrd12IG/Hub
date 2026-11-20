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

// ── Modifiche raggruppate ──────────────────────────────────────────────────────────────────────────────────────────────
// Si segnano più aziende nella pagina e si mandano insieme: un solo comando, una sola modifica del file di Sellbird, una sola
// verifica. Una richiesta per azienda costava un giro di attesa a testa.

export const MAX_BATCH = 100;

export type ExclusionChange = { action: 'add' | 'remove'; domain: string };
export type BatchContext = {
    /** Fra i domini da aggiungere, quelli che la hub conosce come aziende trovate da Sellbird. */
    knownDomains: Set<string>;
    /** I domini già in «mai contattare», come li ha dichiarati il ponte. */
    exclusions: string[];
};
export type BatchResult = { ok: true; changes: ExclusionChange[]; skipped: number } | { ok: false; error: string; status: number };

const failBatch = (error: string, status = 400): BatchResult => ({ ok: false, error, status });

/**
 * Controlla un gruppo di modifiche. Una modifica già avvenuta (escludere chi è già escluso, riammettere chi non è in lista) si salta
 * senza errore: succede se un altro gruppo è stato applicato nel frattempo. Un dominio non valido o sconosciuto, invece, ferma tutto:
 * meglio rifiutare il gruppo che applicarne metà.
 */
export function buildExclusionBatch(body: any, ctx: BatchContext): BatchResult {
    const raw: unknown = body?.changes;
    if (!Array.isArray(raw) || raw.length === 0) return failBatch('Nessuna modifica da applicare.');
    if (raw.length > MAX_BATCH) return failBatch(`Al massimo ${MAX_BATCH} modifiche per volta.`);

    const listed = new Set(ctx.exclusions);
    const seen = new Set<string>();
    const changes: ExclusionChange[] = [];
    let skipped = 0;
    for (const item of raw) {
        const action = (item as any)?.action;
        const domain = cleanDomain((item as any)?.domain);
        if (action !== 'add' && action !== 'remove') return failBatch('Ogni modifica deve essere add o remove.');
        if (!domain) return failBatch('Dominio non valido in una delle modifiche.');
        if (seen.has(domain)) return failBatch(`${domain} compare due volte.`);
        seen.add(domain);

        if (action === 'add') {
            if (listed.has(domain)) { skipped++; continue; }
            if (!ctx.knownDomains.has(domain)) return failBatch(`${domain}: azienda sconosciuta, si esclude solo un dominio che Sellbird ha trovato.`, 404);
        } else if (!listed.has(domain)) {
            skipped++;
            continue;
        }
        changes.push({ action, domain });
    }
    if (changes.length === 0) return failBatch('Niente da fare: le modifiche risultano già applicate.', 409);
    const after = ctx.exclusions.length + changes.filter((c) => c.action === 'add').length - changes.filter((c) => c.action === 'remove').length;
    if (after > MAX_EXCLUSIONS) return failBatch('Lista «mai contattare» troppo lunga: pulisci quella di Sellbird.', 409);
    return { ok: true, changes, skipped };
}
