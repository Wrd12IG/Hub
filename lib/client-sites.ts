/**
 * lib/client-sites.ts
 *
 * I siti web di un cliente. Prima ogni cliente aveva UN sito, UN Analytics e UNA Search Console (campi `websiteUrl`,
 * `ga4PropertyId`, `windsorAccounts.searchconsole`); ora ne può avere più, di solito uno per marca. Pura (nessun I/O).
 *
 * I siti stanno alla pari in `sites[]`. Il PRIMO si ricopia anche nei campi vecchi: serve a tutto ciò che per sua natura
 * lavora su un sito solo (monitor del sito, audit SEO, ricerca dei competitor) e ai punti che non sono ancora passati ai
 * siti multipli. I due versi della sincronia stanno qui, con i test:
 *  - `legacyFromSites`: dai siti ai campi vecchi (quando si salvano i siti);
 *  - `applyLegacyPatch`: dai campi vecchi al primo sito (quando la scheda «Setup API» modifica i campi vecchi).
 * Un cliente che non ha mai salvato i siti ha un sito «virtuale» ricavato dai campi vecchi: nessuna migrazione.
 */

/** Identificativo del sito ricavato dai campi vecchi. Resta tale finché si salvano i siti. */
export const MAIN_SITE_ID = 'main';
export const MAX_SITES = 8;
export const BRAND_MAX = 40;

export interface ClientSite {
    id: string;
    /** https://www.esempio.it (senza barra finale) */
    url: string;
    /** Marca a cui appartiene il sito (testo libero, es. «Renault»). Facoltativa. */
    brand?: string;
    /** Property ID di GA4: solo numeri. */
    ga4PropertyId?: string;
    /** Proprietà Search Console: `sc-domain:esempio.it` oppure l'URL con prefisso `https://www.esempio.it/`. */
    searchConsole?: string;
}

/** I campi di un cliente che contano per i siti. */
export interface ClientSiteFields {
    websiteUrl?: string | null;
    ga4PropertyId?: string | null;
    windsorAccounts?: { searchconsole?: string | null } | null;
    sites?: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Un sito letto dal database: scarta ciò che non è usabile (senza id o senza nulla di utile). */
function readSite(raw: unknown): ClientSite | null {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const id = str(r.id);
    if (!id) return null;
    const url = str(r.url);
    const ga4 = str(r.ga4PropertyId);
    const sc = str(r.searchConsole);
    if (!url && !ga4 && !sc) return null;
    const brand = str(r.brand);
    return { id, url, ...(brand ? { brand } : {}), ...(ga4 ? { ga4PropertyId: ga4 } : {}), ...(sc ? { searchConsole: sc } : {}) };
}

/** I siti del cliente. Senza `sites` salvati, uno solo ricavato dai campi vecchi (se ce n'è qualcuno). */
export function sitesOf(client: ClientSiteFields | null | undefined): ClientSite[] {
    if (!client) return [];
    if (Array.isArray(client.sites) && client.sites.length > 0) {
        const seen = new Set<string>();
        const out: ClientSite[] = [];
        for (const raw of client.sites) {
            const s = readSite(raw);
            if (s && !seen.has(s.id)) { seen.add(s.id); out.push(s); }
        }
        if (out.length > 0) return out;
    }
    const url = str(client.websiteUrl);
    const ga4 = str(client.ga4PropertyId);
    const sc = str(client.windsorAccounts?.searchconsole);
    if (!url && !ga4 && !sc) return [];
    return [{ id: MAIN_SITE_ID, url, ...(ga4 ? { ga4PropertyId: ga4 } : {}), ...(sc ? { searchConsole: sc } : {}) }];
}

/** Il sito con quell'id; senza id (o se non c'è) il primo. `null` se il cliente non ha siti. */
export function findSite(client: ClientSiteFields | null | undefined, id?: string | null): ClientSite | null {
    const all = sitesOf(client);
    if (all.length === 0) return null;
    return (id ? all.find((s) => s.id === id) : undefined) ?? (id ? null : all[0]);
}

/** Le marche presenti, senza doppioni (anche se scritte con maiuscole diverse) e in ordine. */
export function brandsOf(sites: ClientSite[]): string[] {
    const byKey = new Map<string, string>();
    for (const s of sites) {
        const b = (s.brand ?? '').trim();
        if (b && !byKey.has(b.toLowerCase())) byKey.set(b.toLowerCase(), b);
    }
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
}

/** I siti di una marca. Senza marca (`null`) tutti. I siti senza marca compaiono solo in «tutte». */
export function filterByBrand(sites: ClientSite[], brand: string | null | undefined): ClientSite[] {
    const b = (brand ?? '').trim().toLowerCase();
    if (!b) return sites;
    return sites.filter((s) => (s.brand ?? '').trim().toLowerCase() === b);
}

/** I campi vecchi come devono essere, dato l'elenco: quelli del primo sito. `null` = da togliere. */
export function legacyFromSites(sites: ClientSite[]): { websiteUrl: string | null; ga4PropertyId: string | null; searchConsole: string | null } {
    const first = sites[0];
    return { websiteUrl: first?.url || null, ga4PropertyId: first?.ga4PropertyId || null, searchConsole: first?.searchConsole || null };
}

/**
 * Una modifica ai campi vecchi (dalla scheda «Setup API») riportata sul primo sito. Un campo non presente nella modifica
 * non si tocca; uno presente ma vuoto si toglie. Senza siti ne nasce uno «main».
 */
export function applyLegacyPatch(sites: ClientSite[], patch: { websiteUrl?: string | null; ga4PropertyId?: string | null; searchConsole?: string | null }): ClientSite[] {
    const next = sites.map((s) => ({ ...s }));
    if (next.length === 0) next.push({ id: MAIN_SITE_ID, url: '' });
    const first = next[0];
    if ('websiteUrl' in patch) first.url = str(patch.websiteUrl);
    if ('ga4PropertyId' in patch) { const v = str(patch.ga4PropertyId); if (v) first.ga4PropertyId = v; else delete first.ga4PropertyId; }
    if ('searchConsole' in patch) { const v = str(patch.searchConsole); if (v) first.searchConsole = v; else delete first.searchConsole; }
    // Un primo sito rimasto senza niente non serve più
    return next.filter((s) => s.url || s.ga4PropertyId || s.searchConsole);
}

/**
 * Una modifica ai campi vecchi (la scheda «Setup API», il modulo del cliente) è arrivata in `body`: se il cliente ha già i
 * siti salvati, ritorna l'elenco aggiornato da salvare insieme; altrimenti `null` (i campi vecchi bastano da soli).
 * I campi della Search Console arrivano come percorso puntato `windsorAccounts.searchconsole` o dentro `windsorAccounts`.
 */
export function sitesAfterLegacyEdit(client: ClientSiteFields | null | undefined, body: Record<string, unknown>): ClientSite[] | null {
    if (!client || !Array.isArray(client.sites) || client.sites.length === 0) return null;
    const patch: { websiteUrl?: string | null; ga4PropertyId?: string | null; searchConsole?: string | null } = {};
    const asText = (v: unknown): string | null => (typeof v === 'string' ? v : null);
    if ('websiteUrl' in body) patch.websiteUrl = asText(body.websiteUrl);
    if ('ga4PropertyId' in body) patch.ga4PropertyId = asText(body.ga4PropertyId);
    if ('windsorAccounts.searchconsole' in body) patch.searchConsole = asText(body['windsorAccounts.searchconsole']);
    else if (body.windsorAccounts && typeof body.windsorAccounts === 'object' && 'searchconsole' in (body.windsorAccounts as object)) {
        patch.searchConsole = asText((body.windsorAccounts as Record<string, unknown>).searchconsole);
    }
    if (Object.keys(patch).length === 0) return null;
    return applyLegacyPatch(sitesOf(client), patch);
}

/** Come si chiama un sito a schermo e nei report: «Renault · www.esempio.it», o solo l'indirizzo, o l'id. */
export function siteLabel(site: ClientSite): string {
    const host = site.url.replace(/^https?:\/\//, '');
    return [site.brand, host].filter(Boolean).join(' · ') || site.id;
}

export interface ReportTarget {
    /** Property ID di GA4, oppure la proprietà Search Console. */
    id: string;
    /** Solo se ce n'è più d'uno: serve a distinguerli nel report. Con uno solo il report resta com'era. */
    label?: string;
}

/**
 * Cosa deve leggere il report: gli Analytics e le Search Console di TUTTI i siti, senza doppioni (due siti che puntano
 * alla stessa proprietà contano una volta). Con un solo sito il risultato è quello di sempre, senza etichetta.
 */
export function reportTargets(client: ClientSiteFields | null | undefined): { ga4: ReportTarget[]; searchConsole: ReportTarget[] } {
    const sites = sitesOf(client);
    const pick = (get: (s: ClientSite) => string | undefined): ReportTarget[] => {
        const seen = new Set<string>();
        const picked: { id: string; site: ClientSite }[] = [];
        for (const site of sites) {
            const id = get(site);
            if (id && !seen.has(id)) { seen.add(id); picked.push({ id, site }); }
        }
        return picked.map(({ id, site }) => (picked.length > 1 ? { id, label: siteLabel(site) } : { id }));
    };
    return { ga4: pick((s) => s.ga4PropertyId), searchConsole: pick((s) => s.searchConsole) };
}

/** «esempio.it», «www.esempio.it/» o «https://esempio.it» → «https://esempio.it». `''` se non è un indirizzo. */
export function normalizeUrl(input: unknown): string {
    const raw = str(input);
    if (!raw) return '';
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const clean = withScheme.replace(/\/+$/, '');
    return /^https?:\/\/[^\s/]+\.[^\s/]+(\/\S*)?$/i.test(clean) ? clean : '';
}

const GA4_ID = /^\d{6,15}$/;
const SC_DOMAIN = /^sc-domain:[^\s/]+\.[^\s/]+$/i;
const SC_URL = /^https?:\/\/[^\s/]+\.[^\s/]+\/\S*$/i;

export type SitesCheck = { ok: true; sites: ClientSite[] } | { ok: false; error: string };

function newId(taken: Set<string>): string {
    for (;;) {
        const id = `s${Math.random().toString(36).slice(2, 8)}`;
        if (!taken.has(id)) return id;
    }
}

/**
 * Controlla l'elenco ricevuto dalla pagina e lo ripulisce. Gli `id` già noti si conservano (sono usati negli indirizzi delle
 * API e nelle schede); i siti nuovi ne ricevono uno qui, mai dal browser.
 */
export function validateSites(input: unknown, existingIds: readonly string[] = []): SitesCheck {
    if (!Array.isArray(input)) return { ok: false, error: 'Elenco dei siti non valido.' };
    if (input.length > MAX_SITES) return { ok: false, error: `Al massimo ${MAX_SITES} siti per cliente.` };

    const known = new Set(existingIds);
    const taken = new Set<string>();
    const urls = new Set<string>();
    const out: ClientSite[] = [];

    for (let i = 0; i < input.length; i++) {
        const raw = input[i];
        const n = i + 1;
        if (!raw || typeof raw !== 'object') return { ok: false, error: `Sito ${n}: dati non validi.` };
        const r = raw as Record<string, unknown>;

        const url = normalizeUrl(r.url);
        if (!url) return { ok: false, error: `Sito ${n}: l'indirizzo non è valido (es. www.esempio.it).` };
        if (urls.has(url.toLowerCase())) return { ok: false, error: `Sito ${n}: ${url.replace(/^https?:\/\//, '')} è già nell'elenco.` };
        urls.add(url.toLowerCase());

        const brand = str(r.brand);
        if (brand.length > BRAND_MAX) return { ok: false, error: `Sito ${n}: la marca è troppo lunga (massimo ${BRAND_MAX} caratteri).` };

        const ga4 = str(r.ga4PropertyId);
        if (ga4 && !GA4_ID.test(ga4)) return { ok: false, error: `Sito ${n}: il Property ID di GA4 è un numero (es. 345678901), non un'email né il codice G-….` };

        const sc = str(r.searchConsole);
        if (sc && !SC_DOMAIN.test(sc) && !SC_URL.test(sc)) return { ok: false, error: `Sito ${n}: la Search Console è «sc-domain:esempio.it» oppure l'indirizzo completo con la barra finale (https://www.esempio.it/).` };

        // Un id si tiene solo se era già di questo cliente e non è già stato usato in questo elenco
        const given = str(r.id);
        const id = given && known.has(given) && !taken.has(given) ? given : newId(new Set(Array.from(taken).concat(Array.from(known))));
        taken.add(id);

        out.push({ id, url, ...(brand ? { brand } : {}), ...(ga4 ? { ga4PropertyId: ga4 } : {}), ...(sc ? { searchConsole: sc } : {}) });
    }
    return { ok: true, sites: out };
}
